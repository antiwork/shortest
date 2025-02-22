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
  metadata: {
    timestamp: number;
    version: string;
  };
  test: Pick<TestFunction, "name" | "filePath">;
  data: {
    steps?: CacheStep[];
  };
}

export interface CacheStore {
  [key: string]: CacheEntry | undefined;
}
