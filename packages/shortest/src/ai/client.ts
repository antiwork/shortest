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
import { TestCache } from "@/cache/test-cache";
import { getConfig } from "@/index";
import { getLogger, Log } from "@/log";
import { ToolResult } from "@/types";
import { TokenUsage, TokenUsageSchema } from "@/types/ai";
import {
  getErrorDetails,
  AIError,
  AIErrorType,
  asShortestError,
} from "@/utils/errors";
import { sleep } from "@/utils/sleep";

/**
 * Response type for AI client operations.
 *
 * @example
 * ```typescript
 * const response: AIClientResponse = {
 *   response: { status: "passed", message: "Test completed" },
 *   metadata: { usage: { completionTokens: 150, promptTokens: 50, totalTokens: 200 } }
 * };
 * ```
 *
 * @see {@link AIClient} for client implementation
 * @see {@link TokenUsage} for usage tracking
 *
 * @private
 */

// eslint-disable-next-line zod/require-zod-schema-types
export type AIClientResponse = {
  response: AIJSONResponse;
  metadata: {
    usage: TokenUsage;
  };
};

/**
 * Client for handling AI interactions and managing conversation state.
 * Handles retries, caching, and tool execution for AI-driven testing.
 *
 * @class
 * @example
 * ```typescript
 * const client = new AIClient({
 *   browserTool: new BrowserTool(),
 *   testCache: new TestCache()
 * });
 *
 * const response = await client.runAction(
 *   "Navigate to login page",
 *   testFunction
 * );
 * ```
 *
 * @param {BrowserTool} browserTool - Browser automation tool
 * @param {TestCache} cache - Cache for storing test results
 *
 * @see {@link BrowserTool} for web automation
 * @see {@link TestCache} for caching implementation
 *
 * @private
 */
export class AIClient {
  private client: LanguageModelV1;
  private browserTool: BrowserTool;
  private conversationHistory: Array<CoreMessage> = [];
  private testCache: TestCache;
  private log: Log;
  private usage: TokenUsage;
  private apiRequestCount: number = 0;
  private _tools: Record<string, CoreTool> | null = null;

  constructor({
    browserTool,
    testCache,
  }: {
    browserTool: BrowserTool;
    testCache: TestCache;
  }) {
    this.log = getLogger();
    this.log.trace("Initializing AIClient");
    this.client = createProvider(getConfig().ai);
    this.browserTool = browserTool;
    this.testCache = testCache;
    this.usage = TokenUsageSchema.parse({});
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

  /**
   * Executes an AI action with retry logic and error handling.
   * Manages conversation flow and caches results for successful tests.
   *
   * @param {string} prompt - Input prompt for the AI
   * @returns {Promise<AIClientResponse>} Response with results and metadata
   * @throws {AIError} When max retries reached or non-retryable error occurs
   *
   * @example
   * ```typescript
   * const response = await client.runAction(
   *   "Click login button and verify redirect",
   * );
   * ```
   *
   * @private
   */
  async runAction(prompt: string): Promise<AIClientResponse> {
    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const result = await this.runConversation(prompt);
        if (!result) {
          throw new AIError("invalid-response", "No response received from AI");
        }
        return result;
      } catch (error: any) {
        this.log.error("Action failed", getErrorDetails(error));
        if (this.isNonRetryableError(error)) {
          throw asShortestError(error);
        }
        retries++;
        this.log.trace("Retry attempt", { retries, maxRetries: MAX_RETRIES });
        await sleep(5000 * retries);
      }
    }
    throw new AIError("max-retries-reached", "Max retries reached");
  }

  /**
   * Manages conversation flow with the AI including tool execution and response handling.
   * Processes tool calls, updates conversation history, and validates responses.
   *
   * @param {string} prompt - Input prompt to start conversation
   * @returns {Promise<AIClientResponse | undefined>} Processed response
   * @throws {AIError} For invalid responses or tool execution failures
   *
   * @private
   */
  private async runConversation(prompt: string): Promise<AIClientResponse> {
    const initialMessageOptions = { role: "user" as const, content: prompt };
    this.conversationHistory.push(initialMessageOptions);
    this.log.trace("💬", "New conversation message", initialMessageOptions);
    this.log.trace("💬", "Conversation history initialized", {
      totalMessageCount: this.conversationHistory.length,
    });

    while (true) {
      try {
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
            onStepFinish: async (result) => {
              // Useful for additional logging
              // this.log.trace("onStepFinish", {
              //   stepType: result.stepType,
              //   text: result.text,
              //   toolCalls: result.toolCalls,
              //   toolResults: result.toolResults,
              //   finishReason: result.finishReason,
              //   isContinued: result.isContinued,
              //   usage: result.usage,
              // });
              const isMouseMove = (args: any) =>
                args.action === "mouse_move" && args.coordinate.length;

              for (const toolResult of result.toolResults as any[]) {
                let extras: Record<string, unknown> = {};
                if (isMouseMove(toolResult.args)) {
                  const [x, y] = (toolResult.args as any).coordinate;
                  extras.componentStr =
                    await this.browserTool.getNormalizedComponentStringByCoords(
                      x,
                      y,
                    );
                }
                this.testCache.addToSteps({
                  reasoning: result.text,
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
          throw asShortestError(error);
        }

        this.log.trace("Request completed", {
          text: resp.text,
          finishReason: resp.finishReason,
          warnings: resp.warnings,
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
          this.log.trace("tool-calls received as finish reason");
          continue;
        }

        // At this point, response reason is not a tool call, and it's not errored
        try {
          const json = extractJsonPayload(resp.text);
          this.log.trace("Response", { ...json });

          if (json.status === "passed") {
            await this.testCache.set();
          }
          return { response: json, metadata: { usage: this.usage } };
        } catch {
          throw new AIError(
            "invalid-response",
            "AI didn't return the expected JSON payload",
          );
        }
      } finally {
        this.log.resetGroup();
      }
    }
  }

  /**
   * Retrieves or initializes the set of available tools for AI interactions.
   * Includes browser automation, bash execution, and specialized testing tools.
   *
   * @returns {Record<string, CoreTool>} Map of available tools
   *
   * @see {@link BrowserTool} for web automation tools
   * @see {@link BashTool} for shell command execution
   *
   * @private
   */
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
        execute: async ({ command }) => await new BashTool().execute(command),
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

  /**
   * Converts browser tool execution results to standardized content format.
   * Handles image data and text output formatting.
   *
   * @param {ToolResult} result - Raw tool execution result
   * @returns {Array<{type: string, data?: string, text?: string, mimeType?: string}>} Formatted content
   *
   * @private
   */
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

  /**
   * Validates finish reason from language model and throws appropriate errors.
   * Handles token limits, content filtering, and other completion states.
   *
   * @param {LanguageModelV1FinishReason} reason - Completion finish reason
   * @throws {AIError} For invalid or error finish reasons
   *
   * @private
   */
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

  /**
   * Determines if an error should not be retried based on its status code.
   * Non-retryable errors include authentication, authorization, and server errors.
   *
   * @param {any} error - Error to evaluate
   * @returns {boolean} True if error should not be retried
   *
   * @private
   */
  private isNonRetryableError(error: any) {
    return [401, 403, 500].includes(error.status);
  }

  /**
   * Updates token usage statistics with new usage data.
   * Tracks completion, prompt, and total token counts.
   *
   * @param {TokenUsage} usage - New usage data to add
   *
   * @private
   */
  private updateUsage(usage: TokenUsage) {
    this.usage.completionTokens += usage.completionTokens;
    this.usage.promptTokens += usage.promptTokens;
    this.usage.totalTokens += usage.totalTokens;
  }
}
