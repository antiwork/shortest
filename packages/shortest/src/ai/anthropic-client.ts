// TODO: Remove before merging
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/ai/prompts";
import { BashTool } from "@/browser/core/bash-tool";
import { BrowserTool } from "@/browser/core/browser-tool";
import { CONFIG_FILENAME } from "@/constants";
import { getLogger, Log } from "@/log/index";
import { ToolResult } from "@/types";
import { ActionInput } from "@/types/browser";
import { CacheAction, CacheStep } from "@/types/cache";
import { getErrorDetails } from "@/utils/errors";

const AITools = [
  {
    type: "computer_20241022",
    name: "computer",
    display_width_px: 1920,
    display_height_px: 1080,
    display_number: 1,
  },
  {
    name: "github_login",
    description: "Handle GitHub OAuth login with 2FA",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["github_login"],
          description:
            "The action to perform. It's always equal to 'github_login'",
        },
        username: {
          type: "string",
          description: "GitHub username or email",
        },
        password: {
          type: "string",
          description: "GitHub password",
        },
      },
      required: ["action", "username", "password"],
    },
  },
  {
    name: "check_email",
    description: "View received email in new browser tab",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["check_email"],
          description:
            "Check that the email was received with specified content in a new tab",
        },
      },
      required: ["action", "email"],
    },
  },
  {
    name: "sleep",
    description: "Pause test execution for specified duration",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["sleep"],
          description: "The action to perform",
        },
        duration: {
          type: "number",
          description:
            "Duration to sleep in milliseconds (e.g. 5000 for 5 seconds)",
          minimum: 0,
          maximum: 60000,
        },
      },
      required: ["action", "duration"],
    },
  },
  {
    name: "run_callback",
    description: "Run callback function for current test step",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["run_callback"],
          description: "Execute callback for current step",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "navigate",
    description: "Navigate to URLs in new browser tabs",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["navigate"],
          description: "The action to perform",
        },
        url: {
          type: "string",
          description: "The URL to navigate to",
        },
      },
      required: ["action", "url"],
    },
  },
  {
    type: "bash_20241022",
    name: "bash",
  },
] as const;

interface AIConfig {
  apiKey: string;
  model?: string;
  maxMessages?: number;
}

namespace RequestTypes {
  export interface Bash {
    command: string;
  }

  export interface Computer {
    input: ActionInput;
  }

  export interface ToolRequest<T extends Bash | Computer> {
    input: T extends Bash ? Bash : ActionInput;
  }
}

type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;

export class AIClient {
  private client: Anthropic;
  private model: string;
  private maxMessages: number;
  private log: Log;

  constructor(config: AIConfig) {
    this.log = getLogger();
    this.log.trace("Initializing AIClient", { config });
    if (!config.apiKey) {
      this.log.error(
        `Anthropic API key is required. Set it in ${CONFIG_FILENAME} or ANTHROPIC_API_KEY env var`,
      );
      throw new Error(
        `Anthropic API key is required. Set it in ${CONFIG_FILENAME} or ANTHROPIC_API_KEY env var`,
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = "claude-3-5-sonnet-20241022";
    this.maxMessages = 10;
  }

  async processAction(
    prompt: string,
    browserTool: BrowserTool,
    outputCallback?: (
      content: Anthropic.Beta.Messages.BetaContentBlockParam,
    ) => void,
    toolOutputCallback?: (name: string, input: any) => void,
  ): Promise<{
    finalResponse: any;
    tokenUsage: { input: number; output: number };
    pendingCache: any;
  }> {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        return await this.makeRequest(
          prompt,
          browserTool,
          outputCallback,
          toolOutputCallback,
        );
      } catch (error: any) {
        if ([401, 403, 500].includes(error.status)) {
          throw error;
        }

        attempts++;
        if (attempts === maxRetries) throw error;

        this.log.debug("Retry attempt", { attempt: attempts, maxRetries });
        await new Promise((r) => setTimeout(r, 5000 * attempts));
      }
    }
    return {
      finalResponse: null,
      tokenUsage: { input: 0, output: 0 },
      pendingCache: null,
    };
  }

  async makeRequest(
    prompt: string,
    browserTool: BrowserTool,
    _outputCallback?: (
      content: Anthropic.Beta.Messages.BetaContentBlockParam,
    ) => void,
    _toolOutputCallback?: (name: string, input: any) => void,
  ): Promise<{
    messages: any;
    finalResponse: any;
    pendingCache: any;
    tokenUsage: { input: number; output: number };
  }> {
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [];
    const pendingCache: Partial<{ steps?: CacheStep[] }> = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    messages.push({
      role: "user",
      content: prompt,
    });

    while (true) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.log.trace("Making request", { prompt });
        const response = await this.client.beta.messages.create({
          model: this.model,
          max_tokens: 1024,
          messages,
          system: SYSTEM_PROMPT,
          tools: [...AITools],
          betas: ["computer-use-2024-10-22"],
        });

        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
        const tokenUsage = {
          input: totalInputTokens,
          output: totalOutputTokens,
        };

        response.content.forEach((block) => {
          if (block.type === "text") {
            this.log.trace("Response", {
              response: (block as any).text,
            });
          } else if (block.type === "tool_use") {
            const toolBlock = block as Anthropic.Beta.Messages.BetaToolUseBlock;
            this.log.trace("Tool request", {
              tool: toolBlock.name,
              input: toolBlock.input,
            });
          }
        });

        // Add assistant's response to history
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Collect executable tool actions
        const toolRequests = response.content.filter(
          (block) => block.type === "tool_use",
        ) as Anthropic.Beta.Messages.BetaToolUseBlock[];

        if (toolRequests.length > 0) {
          const toolResults = await Promise.all(
            toolRequests.map(async (toolRequest) => {
              switch (toolRequest.name) {
                case "bash":
                  try {
                    const toolResult = await new BashTool().execute(
                      (toolRequest as RequestBash).input.command,
                    );
                    return { toolRequest, toolResult };
                  } catch (error) {
                    this.log.error(
                      "Error executing bash command",
                      getErrorDetails(error),
                    );
                    throw error;
                  }
                default:
                  try {
                    const toolResult = await browserTool.execute(
                      (toolRequest as RequestComputer).input,
                    );

                    let extras: any = {};
                    if ((toolRequest.input as unknown as any).coordinate) {
                      const [x, y] = (toolRequest.input as unknown as any)
                        .coordinate;
                      const componentStr =
                        await browserTool.getNormalizedComponentStringByCoords(
                          x,
                          y,
                        );
                      extras = { componentStr };
                    }

                    // Update the cache
                    pendingCache.steps = [
                      ...(pendingCache.steps || []),
                      {
                        action: toolRequest as CacheAction,
                        reasoning: toolResult.output || "",
                        result: toolResult.output || null,
                        extras,
                        timestamp: Date.now(),
                      },
                    ];

                    return { toolRequest, toolResult };
                  } catch (error) {
                    this.log.error(
                      "Error executing browser tool",
                      getErrorDetails(error),
                    );
                    throw error;
                  }
              }
            }),
          );

          toolResults.forEach((result) => {
            if (result) {
              const { toolRequest, toolResult } = result;

              switch (toolRequest.name) {
                case "bash":
                  messages.push({
                    role: "user",
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: toolRequest.id,
                        content: [
                          {
                            type: "text",
                            text: JSON.stringify(toolResult),
                          },
                        ],
                      },
                    ],
                  });
                  break;
                default:
                  messages.push({
                    role: "user",
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: toolRequest.id,
                        content: (toolResult as ToolResult).base64_image
                          ? [
                              {
                                type: "image" as const,
                                source: {
                                  type: "base64" as const,
                                  media_type: "image/jpeg" as const,
                                  data: (toolResult as ToolResult)
                                    .base64_image!,
                                },
                              },
                            ]
                          : [
                              {
                                type: "text" as const,
                                text: (toolResult as ToolResult).output || "",
                              },
                            ],
                      },
                    ],
                  });
              }
            }
          });
        } else {
          return {
            messages,
            finalResponse: response,
            pendingCache,
            tokenUsage,
          };
        }
      } catch (error: any) {
        if (error.message?.includes("rate_limit")) {
          this.log.debug("⏳", "Rate limited, waiting 60s...");
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        this.log.error("AI request failed", getErrorDetails(error));
        throw error;
      }
    }
  }
}
