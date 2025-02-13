import { LanguageModelUsage } from "ai";
import { z } from "zod";
import { ActionInput } from "./browser";
import { CacheEntry } from "./cache";
import { TestFunction } from "./test";
import { AIJSONResponse } from "@/ai/utils/json";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";

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

interface AIProcessActionResult {
  response: AIJSONResponse;
  metadata: {
    usage: LanguageModelUsage;
  };
}

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;

export interface AIClientOptions {
  browserTool: BrowserTool;
  cache: BaseCache<CacheEntry>;
}
export interface IAIClient {
  processAction(
    prompt: string,
    test: TestFunction,
  ): Promise<AIProcessActionResult | void>;
}

export const TokenUsageSchema = z.object({
  completionTokens: z.number().default(0),
  promptTokens: z.number().default(0),
  totalTokens: z.number().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
