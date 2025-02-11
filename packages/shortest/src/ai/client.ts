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
import pc from "picocolors";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";
import { IAIClient, AIClientOptions } from "@/types/ai";
import { CacheEntry, CacheStep } from "@/types/cache";
import { BashTool } from "@/browser/core/bash-tool";
import { BaseCache } from "@/cache/cache";
import { TestFunction, ToolResult } from "@/types";
import { AIError } from "@/utils/errors";
import { getLogger, Log } from "@/log";
import { getConfig } from "..";
import { createAIProvider } from "./provider";
import { SYSTEM_PROMPT } from "./prompts";
import { aiJSONResponseSchema, extractJsonPayload } from "./utils/json";

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
    // Todo remove it once we have global debug mode access
    this.cache = cache;
    this.log = getLogger();
  }

  async processAction(prompt: string, test: TestFunction) {
    let MAX_RETRIES = 3;
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        return await this.makeRequest(prompt, test);
      } catch (error: any) {
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        retries++;
        if (retries === MAX_RETRIES) throw error;

        this.log.debug(`  Retry attempt ${retries}/${MAX_RETRIES}`);
        await sleep(5000 * retries);
      }
    }
  }

  private async makeRequest(prompt: string, test: TestFunction) {
    this.log.debug(pc.cyan("\n Prompt:"), pc.dim(prompt));

    // Push initial user prompt
    this.conversationHistory.push({
      role: "user",
      content: prompt,
    });

    while (true) {
      let resp;
      try {
        await sleep(1000);
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
        if (NoSuchToolError.isInstance(error)) {
          this.log.error("Tool is not supported");
        } else if (InvalidToolArgumentsError.isInstance(error)) {
          this.log.error("Invalid arguments for a tool were provided");
        }
        throw error;
      }

      this.log.debug(
        `\nLLM step completed with finish reason: '${resp.finishReason}'`,
      );

      for (const { toolName, args } of resp.toolCalls) {
        this.log.debug(`\nTool call: '${toolName}' ${JSON.stringify(args)}`);
      }

      for (const { toolName, result } of resp.toolResults as any) {
        if (result.base64_image) {
          result.base64_image = result.base64_image.substring(0, 25) + "...";
        }

        this.log.debug(
          `\nTool response: '${toolName}' ${JSON.stringify(result)}`,
        );
      }

      this.conversationHistory.push(...resp.response.messages);
      if (resp.finishReason === "tool-calls") continue;
      this.processErrors(resp);

      // At this point, response reason is not a tool call, and it's not errored
      const json = extractJsonPayload(resp.text, aiJSONResponseSchema);

      if (json.status === "passed") {
        this.cache.set(test, this.pendingCache);
      }

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

  private processErrors(
    resp: GenerateTextResult<Record<string, CoreTool>>,
  ): void {
    const reason = resp.finishReason;
    switch (reason) {
      case "length":
        throw new AIError(
          "token-limit-exceeded",
          "Generation stopped because the maximum token length was reached.",
        );
      case "content-filter":
        throw new AIError(
          "unsafe-content-detected",
          "Content filter violation: generation aborted.",
        );
      case "error":
        throw new AIError("unknown", "An error occurred during generation.");
      case "other":
        throw new AIError("unknown", "An error occurred during generation.");
    }
  }

  private addToPendingCache(cacheStep: CacheStep) {
    this.pendingCache.steps = [...(this.pendingCache.steps || []), cacheStep];
  }

  private isNonRetryableError(error: any) {
    return [401, 403, 500].includes(error.status);
  }
}
