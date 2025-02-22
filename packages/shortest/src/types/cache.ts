import { BrowserAction, ActionInput } from "@/types/browser";
import { TestFunction } from "@/types/test";

export interface CacheAction {
  type: "tool_use" | "text";
  name: BrowserAction;
  input: ActionInput;
}

export interface CacheStep {
  reasoning: string; // WHY I DID
  action: CacheAction | null; // WHAT I DID
  timestamp: number; // WHEN I DID
  result: string | null; // OUTCOME
  extras?: any;
}

export interface CacheEntry {
  test: Pick<TestFunction, "name" | "filePath">;
  data: {
    steps?: CacheStep[];
  };
  timestamp: number;
}

export interface CacheStore {
  [key: string]: CacheEntry | undefined;
}
