// eslint-disable-next-line import/no-duplicates
import type { Page, Browser, APIRequest, APIRequestContext } from "playwright";
// eslint-disable-next-line import/no-duplicates
import type * as playwright from "playwright";
import { TestRun } from "@/core/runner/test-run";

export interface AssertionError extends Error {
  matcherResult?: {
    message: string;
    pass: boolean;
    actual: any;
    expected: any;
  };
}

// eslint-disable-next-line zod/require-zod-schema-types
export type TestFileContext = {
  page: Page;
  browser: Browser;
  playwright: typeof playwright & {
    request: APIRequest & {
      newContext: (options?: {
        extraHTTPHeaders?: Record<string, string>;
      }) => Promise<APIRequestContext>;
    };
  };
};

// eslint-disable-next-line zod/require-zod-schema-types
export type TestContext = TestFileContext & {
  testRun: TestRun;
  currentStepIndex?: number;
};

// eslint-disable-next-line zod/require-zod-schema-types
export type TestHookFunction = (context: TestContext) => Promise<void>;

// eslint-disable-next-line zod/require-zod-schema-types
export type TestChain = {
  expect(fn: (context: TestContext) => Promise<void>): TestChain;
  expect(description: string): TestChain;
  expect(
    description: string,
    fn?: (context: TestContext) => Promise<void>,
  ): TestChain;
  expect(
    description: string,
    payload?: any,
    fn?: (context: TestContext) => Promise<void>,
  ): TestChain;
  before(fn: (context: TestContext) => void | Promise<void>): TestChain;
  after(fn: (context: TestContext) => void | Promise<void>): TestChain;
};

// eslint-disable-next-line zod/require-zod-schema-types
export type TestAPI = {
  (fn: (context: TestContext) => Promise<void>): TestChain;
  (name: string): TestChain;
  (names: string[]): TestChain;
  (name: string, fn?: (context: TestContext) => Promise<void>): TestChain;
  (
    name: string,
    payload?: any,
    fn?: (context: TestContext) => Promise<void>,
  ): TestChain;

  beforeAll(fn: (context: TestContext) => Promise<void>): void;
  beforeAll(name: string, fn: (context: TestContext) => Promise<void>): void;

  afterAll(fn: (context: TestContext) => Promise<void>): void;
  afterAll(name: string, fn: (context: TestContext) => Promise<void>): void;

  beforeEach(fn: (context: TestContext) => Promise<void>): void;
  beforeEach(name: string, fn: (context: TestContext) => Promise<void>): void;

  afterEach(fn: (context: TestContext) => Promise<void>): void;
  afterEach(name: string, fn: (context: TestContext) => Promise<void>): void;
};

export type { Page } from "playwright";
