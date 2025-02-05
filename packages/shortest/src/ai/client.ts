import {
  CoreMessage,
  CoreTool,
  FinishReason,
  generateText,
  InvalidToolArgumentsError,
  LanguageModelV1,
  NoSuchToolError,
  tool,
} from "ai";
import { z } from "zod";
import { BrowserTool } from "../browser/core/browser-tool";
import { ILLMClient, ILLMClientOptions } from "../types/ai";
import { CacheEntry, CacheStep } from "../types/cache";
import { SYSTEM_PROMPT } from "./prompts";
import { anthropic } from "@ai-sdk/anthropic";
import { createAIClient } from "./client-provider";
import { BashTool } from "@/browser/core/bash-tool";
import { TestFunction, ToolResult } from "@/types";
import { sleep } from "@anthropic-ai/sdk/core";
import { LLMError } from "@/utils/errors";
import { formatZodError } from "@/utils/zod";
import { BaseCache } from "@/cache/cache";
import { llmResultSchema } from "./validation";

export class LLMClient implements ILLMClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private pendingCache: Partial<{ steps?: CacheStep[] }> = {};
  private cache: BaseCache<CacheEntry>;
  private isDebugMode: boolean;

  constructor({ config, browserTool, isDebugMode, cache }: ILLMClientOptions) {
    this.client = createAIClient(config);
    this.browserTool = browserTool;
    // Todo remove it once we have global debug mode access
    this.isDebugMode = isDebugMode;
    this.cache = cache;
  }

  async processAction(prompt: string, test: TestFunction) {
    try {
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
            experimental_continueSteps: true,
            maxTokens: 1024,
            onStepFinish: async (event) => {
              function isMouseMove(args: any) {
                console.log({ args });
                return args.action === "mouse_move" && args.coordinate.length;
              }

              for (const toolResult of event.toolResults as any) {
                if (toolResult.toolName === "computer") {
                  let extras: Record<string, unknown> = {};
                  if (isMouseMove(toolResult.args)) {
                    const [x, y] = (toolResult.args as any).coordinate;
                    extras.componentStr =
                      await this.browserTool.getNormalizedComponentStringByCoords(
                        x,
                        y,
                      );
                  }

                  // Update pending cache
                  this.pendingCache.steps = [
                    ...(this.pendingCache.steps || []),
                    {
                      action: toolResult,
                      reasoning: toolResult.text,
                      result: toolResult.text,
                      extras,
                      timestamp: Date.now(),
                    },
                  ];
                }
              }
            },
          });
        } catch (error) {
          if (NoSuchToolError.isInstance(error)) {
            console.log("Tool is not supported");
          } else if (InvalidToolArgumentsError.isInstance(error)) {
            console.log("Invalid arguments for a tool were provided");
          }
          throw error;
        }

        if (this.isDebugMode) {
          for (const { toolName, args } of resp.toolCalls) {
            process.stdout.write(
              `\nTool call: '${toolName}' ${JSON.stringify(args)}`,
            );
          }

          for (const { toolName, result } of resp.toolResults) {
            process.stdout.write(
              `\nTool response: '${toolName}' ${JSON.stringify(result)}`,
            );
          }
        }

        this.conversationHistory.push(...resp.response.messages);
        if (resp.finishReason === "tool-calls") continue;
        this.handleFinishReasonErrors(resp.finishReason);

        // At this point, response reason is not a tool call, and it's not errored
        const jsonMatch = resp.text.match(/{[\s\S]*}/)?.[0];

        if (!jsonMatch) {
          throw new LLMError("invalid-response", "LLM didn't return JSON.");
        }

        let parsedResponse;
        try {
          parsedResponse = llmResultSchema.parse(JSON.parse(jsonMatch));
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new LLMError(
              "invalid-response",
              formatZodError(error, "Invalid LLM response."),
            );
          }
          throw error;
        }

        if (parsedResponse.result === "pass") {
          this.cache.set(test, this.pendingCache);
        }

        return {
          response: parsedResponse,
          metadata: {
            usage: resp.usage,
          },
        };
      }
    } catch (error) {
      console.log("AI processing error occured");
      throw error;
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

  private handleFinishReasonErrors(reason: FinishReason): void {
    switch (reason) {
      case "length":
        throw new LLMError(
          "token-limit-exceeded",
          "Generation stopped because the maximum token length was reached.",
        );
      case "content-filter":
        throw new LLMError(
          "unsafe-content-detected",
          "Content filter violation: generation aborted.",
        );
      case "error":
        throw new LLMError("unknown", "An error occurred during generation.");
      case "other":
        throw new LLMError("unknown", "An error occurred during generation.");
    }
  }
}
