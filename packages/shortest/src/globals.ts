import type { TestFunction } from "@/types";

declare global {
  // We need to use var here since it's a global declaration
  // eslint-disable-next-line no-var
  var __shortest__: {
    expect: any;
    registry: {
      tests: Map<string, TestFunction[]>;
      currentFileTests: TestFunction[];
      beforeAllFns: (() => Promise<void>)[];
      afterAllFns: (() => Promise<void>)[];
      beforeEachFns: (() => Promise<void>)[];
      afterEachFns: (() => Promise<void>)[];
      directTestCounter: number;
    };
  };
}
