import type { Expect } from "expect";
import type { TestFunction, TestContext } from "@/types";

declare global {
  namespace NodeJS {
    interface Global {
      __shortest__: {
        expect: Expect;
        registry: {
          tests: Map<string, TestFunction[]>;
          currentFileTests: TestFunction[];
          beforeAllFns: ((ctx: TestContext) => Promise<void>)[];
          afterAllFns: ((ctx: TestContext) => Promise<void>)[];
          beforeEachFns: ((ctx: TestContext) => Promise<void>)[];
          afterEachFns: ((ctx: TestContext) => Promise<void>)[];
          directTestCounter: number;
        };
      };
      expect: Expect;
    }
  }
}
