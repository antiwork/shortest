import { LanguageModelUsage } from "ai";
import { ActionInput } from "./browser";
import { CacheEntry } from "./cache";
import { AIConfig } from "./config";
import { TestFunction } from "./test";
import { LLMJSONResponse } from "@/ai/validation";
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

interface LLMProcessActionResult {
  response: LLMJSONResponse;
  metadata: {
    usage: LanguageModelUsage;
  };
}

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;

export interface AIClientOptions {
  config: AIConfig;
  browserTool: BrowserTool;
  isDebugMode: boolean;
  cache: BaseCache<CacheEntry>;
}
export interface IAIClient {
  processAction(
    prompt: string,
    test: TestFunction,
  ): Promise<LLMProcessActionResult | void>;
}

export type AISupportedModels = "claude-3-5-sonnet";
