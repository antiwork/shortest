import { anthropic } from "@ai-sdk/anthropic";
import { sleep } from "@anthropic-ai/sdk/core";
import {
  CoreMessage,
  CoreTool,
  generateText,
  GenerateTextResult,
  InvalidToolArgumentsError,
  LanguageModelV1,
  NoSuchToolError,
  tool,
} from "ai";
import { z } from "zod";

import { getConfig } from "..";
import { SYSTEM_PROMPT } from "./prompts";
import { createAIProvider } from "./provider";
import { aiJSONResponseSchema, extractJsonPayload } from "./utils/json";
import { BashTool } from "@/browser/core/bash-tool";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";
import { getLogger, Log } from "@/log";
import { IAIClient, AIClientOptions, TestFunction, ToolResult } from "@/types";
import { CacheEntry, CacheStep } from "@/types/cache";
import { getErrorDetails, AIError } from "@/utils/errors";

export class AIClient implements IAIClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private pendingCache: Partial<{ steps?: CacheStep[] }> = {};
  private cache: BaseCache<CacheEntry>;
  private log: Log;

  constructor({ browserTool, cache }: AIClientOptions) {
    this.client = createAIProvider(getConfig().ai);
    this.browserTool = browserTool;
    this.cache = cache;
    this.log = getLogger();
  }

  async processAction(prompt: string, test: TestFunction) {
    const MAX_RETRIES = 3;
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        return await this.makeRequest(prompt, test);
      } catch (error: any) {
        this.log.error("Action failed", getErrorDetails(error));
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        retries++;
        if (retries === MAX_RETRIES) throw error;

        this.log.trace("Retry attempt", {
          retries: retries,
          maxRetries: MAX_RETRIES,
        });
        await sleep(5000 * retries);
      }
    }
  }

  private async makeRequest(prompt: string, test: TestFunction) {
    // Push initial user prompt
    this.conversationHistory.push({
      role: "user",
      content: prompt,
    });
    let aiRequestCount = 0;

    while (true) {
      let resp;
      try {
        await sleep(1000);
        aiRequestCount++;
        this.log.setGroup(`${aiRequestCount}`);
        this.log.trace("Making AI request", { prompt });
        resp = await generateText({
          system: SYSTEM_PROMPT,
          model: this.client,
          messages: this.conversationHistory,
          tools: this.tools,
          maxTokens: 1024,
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

      this.conversationHistory.push(...resp.response.messages);
      if (resp.finishReason === "tool-calls") {
        this.log.resetGroup();
        continue;
      }
      this.processError(resp);

      // At this point, response reason is not a tool call, and it's not errored
      const json = extractJsonPayload(resp.text, aiJSONResponseSchema);
      this.log.trace("👿");
      this.log.trace("AI response", { ...json });

      if (json.status === "passed") {
        this.cache.set(test, this.pendingCache);
      }
      this.log.resetGroup();
      return {
        response: json,
        metadata: {
          usage: resp.usage,
        },
      };
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

  private processError(
    resp: GenerateTextResult<Record<string, CoreTool>>,
  ): void {
    const reason = resp.finishReason;
    switch (reason) {
      case "length":
        this.log.resetGroup();
        throw new AIError(
          "token-limit-exceeded",
          "Generation stopped because the maximum token length was reached.",
        );
      case "content-filter":
        this.log.resetGroup();
        throw new AIError(
          "unsafe-content-detected",
          "Content filter violation: generation aborted.",
        );
      case "error":
        this.log.resetGroup();
        throw new AIError("unknown", "An error occurred during generation.");
      case "other":
        this.log.resetGroup();
        throw new AIError("unknown", "An error occurred during generation.");
    }
  }

  private addToPendingCache(cacheStep: CacheStep) {
    this.log.trace("Adding to pending cache", { cacheStep });
    this.pendingCache.steps = [...(this.pendingCache.steps || []), cacheStep];
  }

  private isNonRetryableError(error: any) {
    return [401, 403, 500].includes(error.status);
  }
}
