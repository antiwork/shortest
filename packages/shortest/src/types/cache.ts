import { TokenUsage } from "./ai";
import { TestStatus } from "@/core/runner";
import { TestCase } from "@/core/runner/test-case";
import { BrowserAction, ActionInput } from "@/types/browser";

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
    version: number;
    status: TestStatus;
    reason: string | undefined;
    tokenUsage: TokenUsage;
    runId: string;
    executedFromCache: boolean;
  };
  test: Pick<TestCase, "name" | "filePath">;
  data: {
    steps?: CacheStep[];
  };
}

export interface CacheStore {
  [key: string]: CacheEntry | undefined;
}
