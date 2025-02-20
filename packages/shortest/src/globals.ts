import type { TestFunction, TestContext } from "@/types";

/* eslint-disable no-var */
declare global {
  var __shortest__: {
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
/* eslint-enable no-var */
