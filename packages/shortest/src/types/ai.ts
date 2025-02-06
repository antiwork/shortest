import { LanguageModelUsage } from "ai";
import { ActionInput } from "./browser";
import { CacheEntry } from "./cache";
import { LLMConfig } from "./config";
import { TestFunction } from "./test";
import { LLMJSONResponse } from "@/ai/validation";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";

export enum LLMSupportedProviders {
  ANTHROPIC = "anthropic",
}
export type LLMSupportedProvidersType = `${LLMSupportedProviders}`;

export enum LLMSupportedModels {
  CLAUDE_3_5_SONNET = "claude-3-5-sonnet",
}
export type LLMSupportedModelsType = `${LLMSupportedModels}`;

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

export interface ILLMClientOptions {
  config: LLMConfig;
  browserTool: BrowserTool;
  isDebugMode: boolean;
  cache: BaseCache<CacheEntry>;
}
export interface ILLMClient {
  processAction(
    prompt: string,
    test: TestFunction,
  ): Promise<LLMProcessActionResult | void>;
}

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;
