import { anthropic } from "@ai-sdk/anthropic";
import { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import {
  CoreMessage,
  CoreTool,
  generateText,
  LanguageModelV1,
  NoSuchToolError,
  tool,
} from "ai";
import { z } from "zod";

import { SYSTEM_PROMPT } from "@/ai/prompts";
import { createProvider } from "@/ai/provider";
import { AIJSONResponse, extractJsonPayload } from "@/ai/utils/json";
import { BashTool } from "@/browser/core/bash-tool";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";
import { getConfig } from "@/index";
import { getLogger, Log } from "@/log";
import { TestFunction, ToolResult } from "@/types";
import { TokenUsage, TokenUsageSchema } from "@/types/ai";
import { CacheEntry, CacheStep } from "@/types/cache";
import { getErrorDetails, AIError, AIErrorType } from "@/utils/errors";
import { sleep } from "@/utils/sleep";

export type AIClientResponse = {
  response: AIJSONResponse;
  metadata: {
    usage: TokenUsage;
  };
};

export class AIClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private pendingCache: Partial<{ steps?: CacheStep[] }> = {};
  private cache: BaseCache<CacheEntry>;
  private log: Log;
  private usage: TokenUsage;
  private apiRequestCount: number = 0;
  private _tools: Record<string, CoreTool> | null = null;

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
    this.log.trace("AIClient initialized");
    this.log.trace(
      "Available tools",
      Object.fromEntries(
        Object.entries(this.tools).map(([name, tool]) => [
          name,
          (tool as any).description || "No description",
        ]),
      ),
    );
  }

  async runAction(
    prompt: string,
    test: TestFunction,
  ): Promise<AIClientResponse> {
    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const result = await this.runConversation(prompt, test);
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

  private async runConversation(prompt: string, test: TestFunction) {
    const initialMessageOptions = {
      role: "user" as const,
      content: prompt,
    };
    this.conversationHistory.push(initialMessageOptions);
    this.log.trace("💬", "New conversation message", initialMessageOptions);
    this.log.trace("💬", "Conversation history initialized", {
      totalMessageCount: this.conversationHistory.length,
    });

    while (true) {
      this.apiRequestCount++;
      this.log.setGroup(`${this.apiRequestCount}`);
      let resp;
      try {
        await sleep(1000);
        this.log.trace("Calling generateText", {
          conversationMessageCount: this.conversationHistory.length,
        });

        resp = await generateText({
          system: SYSTEM_PROMPT,
          model: this.client,
          maxTokens: 1024,
          tools: this.tools,
          messages: this.conversationHistory,
          onStepFinish: async ({
            // stepType,
            text,
            // toolCalls,
            toolResults,
            // finishReason,
            // usage,
            // isContinued,
          }) => {
            // this.log.trace("onStepFinish", {
            //   stepType,
            //   text,
            //   toolCalls,
            //   toolResults,
            //   finishReason,
            //   isContinued,
            //   usage,
            // });
            function isMouseMove(args: any) {
              return args.action === "mouse_move" && args.coordinate.length;
            }

            for (const toolResult of toolResults as any[]) {
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
                reasoning: text,
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
          error: error as Error,
          fullError: JSON.stringify(error, null, 2),
          errorDetails: getErrorDetails(error),
        });
        if (NoSuchToolError.isInstance(error)) {
          this.log.error("Tool is not supported");
        }
        throw error;
      }

      this.log.trace("Request completed", {
        text: resp.text,
        finishReason: resp.finishReason,
        // usage: resp.usage,
        warnings: resp.warnings,
        // responseMessages: resp.response.messages.map((m) => ({
        //   role: m.role,
        // })),
      });

      this.updateUsage(resp.usage);
      resp.response.messages.forEach((message) => {
        this.log.trace("💬", "New conversation message", {
          role: message.role,
          content: message.content,
        });
        this.conversationHistory.push(message);
      });
      this.log.trace("💬", "Conversation history updated", {
        newMessageCount: resp.response.messages.length,
        totalMessageCount: this.conversationHistory.length,
      });

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
        return {
          response: json,
          metadata: {
            usage: this.usage,
          },
        };
      } catch {
        throw new AIError(
          "invalid-response",
          "AI didn't return the expected JSON payload",
        );
      } finally {
        this.log.resetGroup();
      }
    }
  }

  private get tools(): Record<string, CoreTool> {
    if (this._tools) return this._tools;

    this._tools = {
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

    return this._tools;
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
      throw new AIError(errorInfo.error, errorInfo.message);
    }
  }

  private addToPendingCache(cacheStep: CacheStep) {
    try {
      this.log.setGroup("💾");
      this.log.debug("Adding step to cache");
      this.pendingCache.steps = [...(this.pendingCache.steps || []), cacheStep];
    } finally {
      this.log.resetGroup();
    }
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
