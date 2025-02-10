import { ActionInput } from "@/types/browser";
export interface AIConfig {
  apiKey: string;
  model?: string;
  maxMessages?: number;
}

export interface AIResponse {
  result: "passed" | "failed";
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

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;
