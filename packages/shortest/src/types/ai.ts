import { LanguageModelUsage } from "ai";
import { ActionInput } from "./browser";
import { ShortestConfig } from "./config";
import { CacheEntry } from "./cache";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BaseCache } from "@/cache/cache";
import { TestFunction } from "./test";

export interface AIConfig {
  apiKey: string;
  model?: string;
  maxMessages?: number;
  debug?: boolean;
}

export type LLMConfig = ShortestConfig["ai"];

export interface LLMResponse {
  result: "pass" | "fail";
  reason: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string | AIMessageContent[];
}

export interface AIMessageContent {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  tool_use_id?: string;
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

interface LLMProcessActionResult {
  response: LLMResponse;
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
  ): Promise<LLMProcessActionResult>;
}

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;
