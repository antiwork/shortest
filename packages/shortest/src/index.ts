import { join } from "path";
import dotenv from "dotenv";
import { expect as jestExpect } from "expect";
import { APIRequest } from "@/browser/core/api-request";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "@/constants";
import { TestCompiler } from "@/core/compiler";
import { createTestCase, TestCase } from "@/core/runner/test-case";
import { getLogger } from "@/log";
import {
  TestAPI,
  TestContext,
  TestChain,
  ShortestStrictConfig,
  CLIOptions,
} from "@/types";
import { parseConfig } from "@/utils/config";
import { ConfigError, ShortestError } from "@/utils/errors";
// to include the global expect in the generated d.ts file
import "./globals";

let globalConfig: ShortestStrictConfig | null = null;
const compiler = new TestCompiler();

// Initialize Shortest namespace and globals
declare const global: {
  __shortest__: any;
  expect: any;
} & typeof globalThis;

if (!global.__shortest__) {
  global.__shortest__ = {
    expect: jestExpect,
    registry: {
      tests: new Map<string, TestCase[]>(),
      currentFileTests: [],
      currentFilePath: "",
      beforeAllFns: [],
      afterAllFns: [],
      beforeEachFns: [],
      afterEachFns: [],
      directTestCount: 0,
    },
  };

  // Attach to global scope
  global.expect = global.__shortest__.expect;

  dotenv.config({ path: join(process.cwd(), ".env") });
  dotenv.config({ path: join(process.cwd(), ENV_LOCAL_FILENAME) });
}

export const initializeConfig = async ({
  cliOptions,
  configDir = process.cwd(),
}: {
  cliOptions?: CLIOptions;
  configDir?: string;
}) => {
  const log = getLogger();
  if (globalConfig) {
    return globalConfig;
  }
  log.trace("Initializing config");

  dotenv.config({ path: join(configDir, ".env") });
  dotenv.config({ path: join(configDir, ENV_LOCAL_FILENAME) });

  const configFiles = [
    CONFIG_FILENAME,
    CONFIG_FILENAME.replace(/\.ts$/, ".js"),
    CONFIG_FILENAME.replace(/\.ts$/, ".mjs"),
  ];

  const configs = [];
  for (const file of configFiles) {
    try {
      const module = await compiler.loadModule(file, configDir);

      const userConfig = module.default;
      const parsedConfig = parseConfig(userConfig, cliOptions);
      configs.push({
        file,
        config: parsedConfig,
      });
    } catch (error) {
      if (error instanceof ConfigError && error.type === "file-not-found") {
        continue;
      }
      throw error;
    }
  }

  if (configs.length === 0) {
    throw new ConfigError(
      "no-config",
      "No config file found. Please create one.",
    );
  }

  if (configs.length > 1) {
    throw new ConfigError(
      "multiple-config",
      `Multiple config files found: ${configs.map((c) => c.file).join(", ")}. Please keep only one.`,
    );
  }
  globalConfig = configs[0].config;
  log.debug("Config initialized", { globalConfig });

  return globalConfig;
};

export const getConfig = (): ShortestStrictConfig => {
  if (!globalConfig) {
    throw new ConfigError(
      "no-config",
      "Config not initialized. Call initializeConfig() first",
    );
  }
  return globalConfig;
};

const createTestChain = (
  nameOrFn: string | string[] | ((context: TestContext) => Promise<void>),
  payloadOrFn?: ((context: TestContext) => Promise<void>) | any,
  fn?: (context: TestContext) => Promise<void>,
): TestChain => {
  const registry = global.__shortest__.registry;

  const normalizeName = (name: string) => name.replace(/\s+/g, " ").trim();
  // Handle array of test names
  if (Array.isArray(nameOrFn)) {
    const tests = nameOrFn.map((name) => {
      const testCase = createTestCase({
        name: normalizeName(name),
        filePath: registry.currentFilePath,
        expectations: [],
      });

      const existingTests = registry.tests.get(name) || [];
      registry.tests.set(name, [...existingTests, testCase]);
      registry.currentFileTests.push(testCase);
      return testCase;
    });

    // Return chain for the last test
    const lastTest = tests[tests.length - 1];
    if (!lastTest.name) {
      throw new ShortestError("Test name is required");
    }
    return createTestChain(lastTest.name, payloadOrFn, fn);
  }

  // Handle direct execution
  if (typeof nameOrFn === "function") {
    registry.directTestCount++;
    const testCase = createTestCase({
      name: `Direct Test #${registry.directTestCount}`,
      filePath: registry.currentFilePath,
      directExecution: true,
      fn: nameOrFn,
    });
    registry.currentFileTests.push(testCase);
    return {
      expect: () => {
        throw new ShortestError(
          "expect() cannot be called on direct execution test",
        );
      },
      after: () => {
        throw new ShortestError(
          "after() cannot be called on direct execution test",
        );
      },
      before: () => {
        throw new ShortestError(
          "before() cannot be called on direct execution test",
        );
      },
    };
  }

  // Rest of existing createTestChain implementation...
  const name = normalizeName(nameOrFn as string);
  const testCase = createTestCase({
    name,
    filePath: registry.currentFilePath,
    payload: typeof payloadOrFn === "function" ? undefined : payloadOrFn,
    fn: typeof payloadOrFn === "function" ? payloadOrFn : fn,
    expectations: [],
  });

  const existingTests = registry.tests.get(name) || [];
  registry.tests.set(name, [...existingTests, testCase]);
  registry.currentFileTests.push(testCase);

  const chain: TestChain = {
    expect(
      descriptionOrFn: string | ((context: TestContext) => Promise<void>),
      payloadOrFn?: any,
      fn?: (context: TestContext) => Promise<void>,
    ) {
      // Handle direct execution for expect
      if (typeof descriptionOrFn === "function") {
        testCase.expectations.push({
          directExecution: true,
          fn: descriptionOrFn,
        });
        return chain;
      }

      // Existing expect implementation...
      testCase.expectations ||= [];
      testCase.expectations.push({
        description: descriptionOrFn,
        payload: typeof payloadOrFn === "function" ? undefined : payloadOrFn,
        fn: typeof payloadOrFn === "function" ? payloadOrFn : fn,
        directExecution: false,
      });
      return chain;
    },
    before(fn: (context: TestContext) => void | Promise<void>) {
      testCase.beforeFn = (context) => Promise.resolve(fn(context));
      return chain;
    },
    after(fn: (context: TestContext) => void | Promise<void>) {
      testCase.afterFn = (context) => Promise.resolve(fn(context));
      return chain;
    },
  };

  return chain;
};

export const test: TestAPI = Object.assign(
  (
    nameOrFn: string | string[] | ((context: TestContext) => Promise<void>),
    payloadOrFn?: ((context: TestContext) => Promise<void>) | any,
    fn?: (context: TestContext) => Promise<void>,
  ) => createTestChain(nameOrFn, payloadOrFn, fn),
  {
    beforeAll: (nameOrFn: string | ((ctx: TestContext) => Promise<void>)) => {
      const hook = typeof nameOrFn === "function" ? nameOrFn : undefined;
      if (hook) global.__shortest__.registry.beforeAllFns.push(hook);
    },
    afterAll: (nameOrFn: string | ((ctx: TestContext) => Promise<void>)) => {
      const hook = typeof nameOrFn === "function" ? nameOrFn : undefined;
      if (hook) global.__shortest__.registry.afterAllFns.push(hook);
    },
    beforeEach: (nameOrFn: string | ((ctx: TestContext) => Promise<void>)) => {
      const hook = typeof nameOrFn === "function" ? nameOrFn : undefined;
      if (hook) global.__shortest__.registry.beforeEachFns.push(hook);
    },
    afterEach: (nameOrFn: string | ((ctx: TestContext) => Promise<void>)) => {
      const hook = typeof nameOrFn === "function" ? nameOrFn : undefined;
      if (hook) global.__shortest__.registry.afterEachFns.push(hook);
    },
  },
);

export const shortest: TestAPI = test;
export type { ShortestConfig } from "@/types/config";
export { APIRequest };
