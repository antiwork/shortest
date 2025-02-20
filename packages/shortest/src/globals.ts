import type { TestFunction, TestContext } from "@/types";

declare global {
  interface Window {
    __shortest__: {
      expect: any;
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
  }
}
