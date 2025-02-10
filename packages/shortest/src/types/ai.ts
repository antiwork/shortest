import { LanguageModelUsage } from "ai";
import { ActionInput } from "./browser";
import { AIConfig } from "./config";
import { TestFunction } from "./test";
import { LLMJSONResponse } from "@/ai/utils/json";
import { BrowserTool } from "@/browser/core/browser-tool";
import { TestCache } from "@/cache/test-cache";
export { Cache } from "@/cache/cache";

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
  cliArgs: {
    isNoCacheMode: boolean;
    isDebugMode: boolean;
  };
  cache: TestCache;
}
export interface IAIClient {
  processAction(
    prompt: string,
    test: TestFunction,
  ): Promise<LLMProcessActionResult | void>;
}

export type AISupportedModels = "claude-3-5-sonnet";
