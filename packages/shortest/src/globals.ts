import type { Expect } from "expect";

declare global {
  let __shortest__: {
    expect: Expect;
    registry: {
      tests: Map<string, any[]>;
      currentFileTests: any[];
      beforeAllFns: any[];
      afterAllFns: any[];
      beforeEachFns: any[];
      afterEachFns: any[];
      directTestCounter: number;
    };
  };
}
