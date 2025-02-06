import { pathToFileURL } from "url";
import { glob } from "glob";
import pc from "picocolors";
import { APIRequest, BrowserContext } from "playwright";
import * as playwright from "playwright";
import { request, APIRequestContext } from "playwright";
import { BrowserTool } from "../../browser/core/browser-tool";
import { BrowserManager } from "../../browser/manager";
import { BaseCache } from "../../cache/cache";
import { initializeConfig, getConfig } from "../../index";
import {
  TestFunction,
  TestContext,
  BrowserActionEnum,
  ShortestConfig,
} from "../../types";
import { CacheEntry } from "../../types/cache";
import { hashData } from "../../utils/crypto";
import { TestCompiler } from "../compiler";
import { TestReporter } from "./test-reporter";
import { LLMClient } from "@/ai/client";

interface TestResult {
  result: "pass" | "fail";
  reason: string;
  tokenUsage?: { input: number; output: number };
}

export class TestRunner {
  private config!: ShortestConfig;
  private cwd: string;
  private exitOnSuccess: boolean;
  private forceHeadless: boolean;
  private targetUrl: string | undefined;
  private compiler: TestCompiler;
  private browserManager!: BrowserManager;
  private reporter: TestReporter;
  private debugAI: boolean;
  private noCache: boolean;
  private testContext: TestContext | null = null;
  private cache: BaseCache<CacheEntry>;

  constructor(
    cwd: string,
    exitOnSuccess = true,
    forceHeadless = false,
    targetUrl?: string,
    debugAI = false,
    noCache = false,
  ) {
    this.cwd = cwd;
    this.exitOnSuccess = exitOnSuccess;
    this.forceHeadless = forceHeadless;
    this.targetUrl = targetUrl;
    this.debugAI = debugAI;
    this.noCache = noCache;
    this.compiler = new TestCompiler();
    this.reporter = new TestReporter();
    this.cache = new BaseCache();
  }

  async initialize() {
    await initializeConfig();
    this.config = getConfig();

    // Override with CLI options
    if (this.forceHeadless) {
      this.config = {
        ...this.config,
        headless: true,
      };
    }

    if (this.targetUrl) {
      this.config = {
        ...this.config,
        baseUrl: this.targetUrl,
      };
    }

    this.browserManager = new BrowserManager(this.config);
  }

  private async findTestFiles(pattern?: string): Promise<string[]> {
    const testPattern = pattern || this.config.testPattern || "**/*.test.ts";

    const files = await glob(testPattern, {
      cwd: this.cwd,
      absolute: true,
    });

    if (files.length === 0) {
      this.reporter.error(
        "Test Discovery",
        `No test files found matching: ${testPattern}`,
      );
      process.exit(1);
    }

    return files;
  }

  private async createTestContext(
    context: BrowserContext,
  ): Promise<TestContext> {
    if (!this.testContext) {
      // Create a properly typed playwright object
      const playwrightObj = {
        ...playwright,
        request: {
          ...request,
          newContext: async (options?: {
            extraHTTPHeaders?: Record<string, string>;
          }) => {
            const requestContext = await request.newContext({
              baseURL: this.config.baseUrl,
              ...options,
            });
            return requestContext;
          },
        },
      } as typeof playwright & {
        request: APIRequest & {
          newContext: (options?: {
            extraHTTPHeaders?: Record<string, string>;
          }) => Promise<APIRequestContext>;
        };
      };

      this.testContext = {
        page: context.pages()[0],
        browser: this.browserManager.getBrowser()!,
        playwright: playwrightObj,
      };
    }
    return this.testContext;
  }

  private async executeTest(
    test: TestFunction,
    context: BrowserContext,
    config: { noCache: boolean } = { noCache: false },
  ): Promise<{
    result: "pass" | "fail";
    reason: string;
    tokenUsage: { input: number; output: number };
  }> {
    // If it's direct execution, skip AI
    if (test.directExecution) {
      try {
        const testContext = await this.createTestContext(context);
        await test.fn?.(testContext);
        return {
          result: "pass" as const,
          reason: "Direct execution successful",
          tokenUsage: { input: 0, output: 0 },
        };
      } catch (error) {
        return {
          result: "fail" as const,
          reason:
            error instanceof Error ? error.message : "Direct execution failed",
          tokenUsage: { input: 0, output: 0 },
        };
      }
    }

    // Use the shared context
    const testContext = await this.createTestContext(context);
    const browserTool = new BrowserTool(testContext.page, this.browserManager, {
      width: 1920,
      height: 1080,
      testContext: {
        ...testContext,
        currentTest: test,
        currentStepIndex: 0,
      },
    });

    const llmClient = new LLMClient({
      config: this.config.ai,
      browserTool,
      isDebugMode: this.debugAI,
      cache: this.cache,
    });

    // First get page state
    const initialState = await browserTool.execute({
      action: "screenshot",
    });

    // Build prompt with initial state and screenshot
    const prompt = [
      `Test: "${test.name}"`,
      test.payload ? `Context: ${JSON.stringify(test.payload)}` : "",
      `Callback function: ${test.fn ? " [HAS_CALLBACK]" : " [NO_CALLBACK]"}`,

      // Add expectations if they exist
      ...(test.expectations?.length
        ? [
            "\nExpect:",
            ...test.expectations.map(
              (exp, i) =>
                `${i + 1}. ${exp.description}${
                  exp.fn ? " [HAS_CALLBACK]" : "[NO_CALLBACK]"
                }`,
            ),
          ]
        : ["\nExpect:", `1. "${test.name}" expected to be successful`]),

      "\nCurrent Page State:",
      `URL: ${initialState.metadata?.window_info?.url || "unknown"}`,
      `Title: ${initialState.metadata?.window_info?.title || "unknown"}`,
    ]
      .filter(Boolean)
      .join("\n");

    // check if CLI option is not specified
    if (!this.noCache && !config.noCache) {
      // if test hasn't changed and is already in cache, replay steps from cache
      if (await this.cache.get(test)) {
        try {
          const result = await this.runCachedTest(test, browserTool);

          if (test.afterFn) {
            try {
              await test.afterFn(testContext);
            } catch (error) {
              return {
                result: "fail" as const,
                reason:
                  result?.result === "fail"
                    ? `AI: ${result.reason}, After: ${
                        error instanceof Error ? error.message : String(error)
                      }`
                    : error instanceof Error
                      ? error.message
                      : String(error),
                tokenUsage: { input: 0, output: 0 },
              };
            }
          }
          return { ...result, tokenUsage: { input: 0, output: 0 } };
        } catch {
          // delete stale cached test entry
          await this.cache.delete(test);
          // reset window state
          const page = browserTool.getPage();
          await page.goto(initialState.metadata?.window_info?.url!);
          await this.executeTest(test, context, {
            noCache: true,
          });
        }
      }
    }

    // Execute before function if present
    if (test.beforeFn) {
      try {
        await test.beforeFn(testContext);
      } catch (error) {
        return {
          result: "fail" as const,
          reason: error instanceof Error ? error.message : String(error),
          tokenUsage: { input: 0, output: 0 },
        };
      }
    }

    // Execute test with enhanced prompt
    const resp = await llmClient.processAction(prompt, test);
    const { response, metadata } = resp!;

    // Execute after function if present
    if (test.afterFn) {
      try {
        await test.afterFn(testContext);
      } catch (error) {
        return {
          result: "fail" as const,
          reason:
            response?.result === "fail"
              ? `AI: ${response.reason}, After: ${
                  error instanceof Error ? error.message : String(error)
                }`
              : error instanceof Error
                ? error.message
                : String(error),
          tokenUsage: {
            input: metadata.usage?.promptTokens ?? 0,
            output: metadata.usage?.completionTokens ?? 0,
          },
        };
      }
    }

    return {
      result: response?.result ?? "fail",
      reason: response?.reason ?? "No response received from LLM.",
      tokenUsage: {
        input: metadata.usage?.promptTokens ?? 0,
        output: metadata.usage?.completionTokens ?? 0,
      },
    };
  }

  private async executeTestFile(file: string) {
    try {
      const registry = (global as any).__shortest__.registry;

      registry.tests.clear();
      registry.currentFileTests = [];

      const filePathWithoutCwd = file.replace(this.cwd + "/", "");
      this.reporter.startFile(filePathWithoutCwd);
      const compiledPath = await this.compiler.compileFile(file);
      await import(pathToFileURL(compiledPath).href);

      let context;
      try {
        context = await this.browserManager.launch();
      } catch (error) {
        console.error(
          `Browser initialization failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
      const testContext = await this.createTestContext(context);

      try {
        // Execute beforeAll hooks with shared context
        for (const hook of registry.beforeAllFns) {
          await hook(testContext);
        }

        // Execute tests in order they were defined
        for (const test of registry.currentFileTests) {
          // Execute beforeEach hooks with shared context
          for (const hook of registry.beforeEachFns) {
            await hook(testContext);
          }

          this.reporter.initializeTest(test);
          this.reporter.startTest(test);
          const result = await this.executeTest(test, context);
          this.reporter.endTest(
            result.result === "pass" ? "passed" : "failed",
            result.result === "fail" ? new Error(result.reason) : undefined,
            result.tokenUsage,
          );

          // Execute afterEach hooks with shared context
          for (const hook of registry.afterEachFns) {
            await hook(testContext);
          }
        }

        // Execute afterAll hooks with shared context
        for (const hook of registry.afterAllFns) {
          await hook(testContext);
        }
      } finally {
        await this.browserManager.close();
        this.testContext = null; // Reset the context
        registry.beforeAllFns = [];
        registry.afterAllFns = [];
        registry.beforeEachFns = [];
        registry.afterEachFns = [];
      }
    } catch (error) {
      this.testContext = null; // Reset on error
      if (error instanceof Error) {
        this.reporter.endTest("failed", error);
      }
    }
  }

  async runTests(pattern?: string) {
    await this.initialize();
    const files = await this.findTestFiles(pattern);

    if (files.length === 0) {
      this.reporter.error(
        "Test Discovery",
        `No test files found matching the pattern: ${pattern || this.config.testPattern}`,
      );
      process.exit(1);
    }

    for (const file of files) {
      await this.executeTestFile(file);
    }

    this.reporter.summary();

    if (this.exitOnSuccess && this.reporter.allTestsPassed()) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }

  private async runCachedTest(
    test: TestFunction,
    browserTool: BrowserTool,
  ): Promise<TestResult> {
    const cachedTest = await this.cache.get(test);
    if (this.debugAI) {
      console.log(pc.green(`  Executing cached test ${hashData(test)}`));
    }

    const steps = cachedTest?.data.steps
      // do not take screenshots in cached mode
      ?.filter(
        (step) =>
          step.action?.input.action !== BrowserActionEnum.Screenshot.toString(),
      );

    if (!steps) {
      return {
        result: "fail" as const,
        reason: "No steps to execute, running test in normal mode",
        tokenUsage: { input: 0, output: 0 },
      };
    }
    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (
        step.action?.input.action === BrowserActionEnum.MouseMove &&
        // @ts-expect-error Interface and actual values differ
        step.action.input.coordinate
      ) {
        // @ts-expect-error
        const [x, y] = step.action.input.coordinate;

        const componentStr =
          await browserTool.getNormalizedComponentStringByCoords(x, y);

        if (componentStr !== step.extras.componentStr) {
          return {
            result: "fail" as const,
            reason:
              "Component UI elements are different, running test in normal mode",
            tokenUsage: { input: 0, output: 0 },
          };
        }
      }
      if (step.action?.input) {
        try {
          await browserTool.execute(step.action.input);
        } catch (error) {
          console.error(
            `Failed to execute step with input ${step.action.input}`,
            error,
          );
        }
      }
    }

    return {
      result: "pass",
      reason: "All actions successfully replayed from cache",
    };
  }
}
