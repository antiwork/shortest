import type { Page, Browser, APIRequest, APIRequestContext } from "playwright";
import type * as playwright from "playwright";

export interface AssertionError extends Error {
  matcherResult?: {
    message: string;
    pass: boolean;
    actual: any;
    expected: any;
  };
}

export class CallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallbackError";
  }
}

export class AssertionCallbackError extends CallbackError {
  constructor(
    message: string,
    public actual?: any,
    public expected?: any,
  ) {
    super(message);
    this.name = "AssertionCallbackError";
  }
}

export type TestContext = {
  page: Page;
  browser: Browser;
  playwright: typeof playwright & {
    request: APIRequest & {
      newContext: (options?: {
        extraHTTPHeaders?: Record<string, string>;
      }) => Promise<APIRequestContext>;
    };
  };
  currentTest?: TestFunction;
  currentStepIndex?: number;
};

export type TestHookFunction = (context: TestContext) => Promise<void>;

export interface TestFunction {
  name: string | "Untitled";
  filePath: string;
  payload?: any;
  fn?: (context: TestContext) => Promise<void>;
  expectations?: {
    description?: string;
    payload?: any;
    fn?: (context: TestContext) => Promise<void>;
    directExecution?: boolean;
  }[];
  beforeFn?: (context: TestContext) => void | Promise<void>;
  afterFn?: (context: TestContext) => void | Promise<void>;
  directExecution?: boolean;
}

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

export type TestRegistry = {
  tests: Map<string, TestFunction[]>;
  currentFileTests: TestFunction[];
  beforeAllFns: TestHookFunction[];
  afterAllFns: TestHookFunction[];
  beforeEachFns: TestHookFunction[];
  afterEachFns: TestHookFunction[];
  directTestCounter: number;
};

export type { Page } from "playwright";
