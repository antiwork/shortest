import { Log } from "../log/index";
import { ActionInput } from "./browser";
export interface AIConfig {
  apiKey: string;
  model?: string;
  maxMessages?: number;
  debug?: boolean;
}

export interface AIResponse {
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

export type RequestBash = RequestTypes.ToolRequest<RequestTypes.Bash>;
export type RequestComputer = RequestTypes.ToolRequest<RequestTypes.Computer>;
