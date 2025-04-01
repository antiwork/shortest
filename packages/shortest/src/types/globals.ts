import type { Expect } from "expect";
import { TestCase } from "@/core/runner/test-case";
import type { TestHookFunction } from "@/types/test";

export interface ShortestGlobals {
  expect: Expect;
  registry: {
    tests: Map<string, TestCase[]>;
    beforeAllFns: TestHookFunction[];
    afterAllFns: TestHookFunction[];
    beforeEachFns: TestHookFunction[];
    afterEachFns: TestHookFunction[];
  };
}
