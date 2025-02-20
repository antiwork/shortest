import type { TestFunction } from "@/types";

declare global {
  namespace NodeJS {
    interface Global {
      __shortest__: {
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
  }
}
