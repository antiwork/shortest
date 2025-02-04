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
import { BrowserTool } from "../browser/core/browser-tool";
import { LLMConfig } from "../types/ai";
import { CacheStep } from "../types/cache";
import { SYSTEM_PROMPT } from "./prompts";
import { anthropic } from "@ai-sdk/anthropic";
import { createAIClient } from "./client-provider";
import { BashTool } from "@/browser/core/bash-tool";
import { ToolResult } from "@/types";

type LLMResponse = any;

interface ILLMClient {
  processAction: (prompt: string) => LLMResponse;
}

export class LLMClient implements ILLMClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private pendingCache: Partial<{ steps?: CacheStep[] }> = {};
  private isDebugMode: boolean;

  constructor(
    config: LLMConfig,
    browserTool: BrowserTool,
    isDebugMode: boolean,
  ) {
    this.client = createAIClient(config);
    this.browserTool = browserTool;
    // todo remove it once we have global debug mode access
    this.isDebugMode = isDebugMode;
  }

  async processAction(prompt: string) {
    try {
      // Push initial user prompt
      this.conversationHistory.push({
        role: "user",
        content: prompt,
      });

      while (true) {
        let resp;
        try {
          resp = await generateText({
            system: SYSTEM_PROMPT,
            model: this.client,
            messages: this.conversationHistory,
            tools: this.tools,
            experimental_continueSteps: true,
            maxTokens: 1024,
            onStepFinish: async (event) => {
              function isMouseMove(args: any) {
                return args.action === "mouse_move" && args.coordinate.length;
              }

              for (const toolResult of event.toolResults as any) {
                if (toolResult.toolName === "computer") {
                  let extras: Record<string, unknown> = {};
                  if (isMouseMove(toolResult.args)) {
                    const [x, y] = (toolResult.anyArgs as any).coordinate;
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
        if (resp.finishReason !== "tool-calls") return resp;
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
}
