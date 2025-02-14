import { anthropic } from "@ai-sdk/anthropic";
import { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import {
  CoreMessage,
  CoreTool,
  generateText,
  InvalidToolArgumentsError,
  LanguageModelV1,
  NoSuchToolError,
  tool,
} from "ai";
import { z } from "zod";

import { getConfig } from "..";
import { SYSTEM_PROMPT } from "./prompts";
import { AIJSONResponse, extractJsonPayload } from "./utils/json";
import { createProvider } from "@/ai/provider";
import { BashTool } from "@/browser/core/bash-tool";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";
import { getLogger, Log } from "@/log";
import { TestFunction, ToolResult } from "@/types";
import { TokenUsage, TokenUsageSchema } from "@/types/ai";
import { CacheEntry, CacheStep } from "@/types/cache";
import { getErrorDetails, AIError, AIErrorType } from "@/utils/errors";
import { sleep } from "@/utils/sleep";

export class AIClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private pendingCache: Partial<{ steps?: CacheStep[] }> = {};
  private cache: BaseCache<CacheEntry>;
  private log: Log;
  private usage: TokenUsage;

  constructor({
    browserTool,
    cache,
  }: {
    browserTool: BrowserTool;
    cache: BaseCache<CacheEntry>;
  }) {
    this.client = createProvider(getConfig().ai);
    this.browserTool = browserTool;
    this.cache = cache;
    this.usage = TokenUsageSchema.parse({});
    this.log = getLogger();
  }

  async processAction(
    prompt: string,
    test: TestFunction,
  ): Promise<{
    response: AIJSONResponse;
    metadata: {
      usage: TokenUsage;
    };
  }> {
    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const result = await this.makeRequest(prompt, test);
        if (!result) {
          throw new AIError("invalid-response", "No response received from AI");
        }
        return result;
      } catch (error: any) {
        this.log.error("Action failed", getErrorDetails(error));
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        retries++;
        this.log.trace("Retry attempt", {
          retries: retries,
          maxRetries: MAX_RETRIES,
        });
        await sleep(5000 * retries);
      }
    }
    throw new AIError("max-retries-reached", "Max retries reached");
  }

  private async makeRequest(prompt: string, test: TestFunction) {
    // Push initial user prompt
    this.conversationHistory.push({
      role: "user",
      content: prompt,
    });
    let requestCount = 0;

    while (true) {
      let resp;
      try {
        await sleep(1000);
        requestCount++;
        this.log.setGroup(`${requestCount}`);
        this.log.trace("Generating text", {
          currentPrompt: prompt,
          messageCount: this.conversationHistory.length,
          // tools: Object.keys(this.tools),
        });
        resp = await generateText({
          system: SYSTEM_PROMPT,
          model: this.client,
          maxTokens: 1024,
          tools: this.tools,
          messages: this.conversationHistory,
          onStepFinish: async (event) => {
            function isMouseMove(args: any) {
              return args.action === "mouse_move" && args.coordinate.length;
            }

            for (const toolResult of event.toolResults as any[]) {
              let extras: Record<string, unknown> = {};
              if (isMouseMove(toolResult.args)) {
                const [x, y] = (toolResult.args as any).coordinate;
                extras.componentStr =
                  await this.browserTool.getNormalizedComponentStringByCoords(
                    x,
                    y,
                  );
              }

              this.addToPendingCache({
                reasoning: event.text,
                action: {
                  name: toolResult.args.action,
                  input: toolResult.args,
                  type: "tool_use",
                },
                result: toolResult.result.output,
                extras,
                timestamp: Date.now(),
              });
            }
          },
        });
      } catch (error) {
        this.log.error("Error making request", {
          ...getErrorDetails(error),
        });
        if (NoSuchToolError.isInstance(error)) {
          this.log.error("Tool is not supported");
        } else if (InvalidToolArgumentsError.isInstance(error)) {
          this.log.error("Invalid arguments for a tool were provided");
        }
        this.log.resetGroup();
        throw error;
      }

      this.log.trace("Request completed", {
        text: resp.text,
        finishReason: resp.finishReason,
        usage: resp.usage,
        warnings: resp.warnings,
        responseMessages: resp.response.messages.map((m) => ({
          role: m.role,
        })),
      });

      for (const { toolName, args } of resp.toolCalls) {
        this.log.trace("Tool call", { name: toolName, ...args });
      }

      for (const { toolName, result } of resp.toolResults as any) {
        this.log.trace("Tool response", { name: toolName, ...result });
      }

      this.updateUsage(resp.usage);
      this.conversationHistory.push(...resp.response.messages);

      this.throwOnErrorFinishReason(resp.finishReason);

      if (resp.finishReason === "tool-calls") {
        this.log.resetGroup();
        continue;
      }

      // At this point, response reason is not a tool call, and it's not errored
      try {
        const json = extractJsonPayload(resp.text);
        this.log.trace("Response", { ...json });

        if (json.status === "passed") {
          this.cache.set(test, this.pendingCache);
        }
        this.log.resetGroup();
        return {
          response: json,
          metadata: {
            usage: this.usage,
          },
        };
      } catch {
        this.log.resetGroup();
        throw new AIError(
          "invalid-response",
          "AI didn't return the expected JSON payload",
        );
      }
    }
  }

  private get tools(): Record<string, CoreTool> {
    return {
      computer: anthropic.tools.computer_20241022({
        displayWidthPx: 1920,
        displayHeightPx: 1080,
        displayNumber: 0,
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
      bash: anthropic.tools.bash_20241022({
        execute: async ({ command }) => {
          return await new BashTool().execute(command);
        },
        experimental_toToolResultContent(result) {
          return [
            {
              type: "text",
              text: result,
            },
          ];
        },
      }),
      github_login: tool({
        description: "Handle GitHub OAuth login with 2FA",
        parameters: z.object({
          action: z.literal("github_login"),
          username: z.string(),
          password: z.string(),
        }),
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
      check_email: tool({
        description: "View received email in new browser tab",
        parameters: z.object({
          action: z.literal("check_email"),
          email: z.string().describe("Email content or address to check for"),
        }),
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
      sleep: tool({
        description: "Pause test execution for specified duration",
        parameters: z.object({
          action: z.literal("sleep"),
          duration: z.number().min(0).max(60000),
        }),
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
      run_callback: tool({
        description: "Run callback function for current test step",
        parameters: z.object({
          action: z.literal("run_callback"),
        }),
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
      navigate: tool({
        description: "Navigate to URLs in new browser tabs",
        parameters: z.object({
          action: z.literal("navigate"),
          url: z.string().url().describe("The URL to navigate to"),
        }),
        execute: this.browserTool.execute.bind(this.browserTool),
        experimental_toToolResultContent:
          this.browserToolResultToToolResultContent,
      }),
    };
  }

  private browserToolResultToToolResultContent(result: ToolResult) {
    return result.base64_image
      ? [
          {
            type: "image" as const,
            data: result.base64_image,
            mimeType: "image/jpeg",
          },
        ]
      : [
          {
            type: "text" as const,
            text: result.output!,
          },
        ];
  }

  private throwOnErrorFinishReason(reason: LanguageModelV1FinishReason): void {
    const errorMap: Partial<
      Record<
        LanguageModelV1FinishReason,
        {
          error: AIErrorType;
          message: string;
        }
      >
    > = {
      length: {
        message:
          "Generation stopped because the maximum token length was reached.",
        error: "token-limit-exceeded",
      },
      "content-filter": {
        message: "Content filter violation: generation aborted.",
        error: "unsafe-content-detected",
      },
      error: {
        message: "An error occurred during generation.",
        error: "unknown",
      },
      other: {
        message: "Generation stopped for an unknown reason.",
        error: "unknown",
      },
    };
    const errorInfo = errorMap[reason];

    if (errorInfo) {
      this.log.resetGroup();
      throw new AIError(errorInfo.error, errorInfo.message);
    }
  }

  private addToPendingCache(cacheStep: CacheStep) {
    this.log.trace("Adding to pending cache");
    this.pendingCache.steps = [...(this.pendingCache.steps || []), cacheStep];
  }

  private isNonRetryableError(error: any) {
    return [401, 403, 500].includes(error.status);
  }

  private updateUsage(usage: TokenUsage) {
    this.usage.completionTokens += usage.completionTokens;
    this.usage.promptTokens += usage.promptTokens;
    this.usage.totalTokens += usage.totalTokens;
  }
}
