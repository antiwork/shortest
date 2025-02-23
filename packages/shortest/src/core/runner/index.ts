import { pathToFileURL } from "url";
import { glob } from "glob";
import { APIRequest, BrowserContext } from "playwright";
import * as playwright from "playwright";
import { request, APIRequestContext } from "playwright";
import { z } from "zod";
import { AIClient, AIClientResponse } from "@/ai/client";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BrowserManager } from "@/browser/manager";
import { TestCache } from "@/cache";
import { TestCompiler } from "@/core/compiler";
import { TestReporter } from "@/core/runner/test-reporter";
import { getLogger, Log } from "@/log";
import {
  TestFunction,
  TestContext,
  BrowserActionEnum,
  ShortestStrictConfig,
} from "@/types";
import { TokenUsageSchema } from "@/types/ai";
import { CacheEntry } from "@/types/cache";
import { getErrorDetails } from "@/utils/errors";

const TestStatusSchema = z.enum(["pending", "running", "passed", "failed"]);
export type TestStatus = z.infer<typeof TestStatusSchema>;

export const TestResultSchema = z.object({
  test: z.any() as z.ZodType<TestFunction>,
  status: TestStatusSchema,
  reason: z.string(),
  tokenUsage: TokenUsageSchema,
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const FileResultSchema = z.object({
  filePath: z.string(),
  status: TestStatusSchema,
  reason: z.string(),
});
export type FileResult = z.infer<typeof FileResultSchema>;

export class TestRunner {
  private config: ShortestStrictConfig;
  private cwd: string;
  private compiler: TestCompiler;
  private browserManager!: BrowserManager;
  private reporter: TestReporter;
  private testContext: TestContext | null = null;
  private log: Log;

  constructor(cwd: string, config: ShortestStrictConfig) {
    this.config = config;
    this.cwd = cwd;
    this.compiler = new TestCompiler();
    this.reporter = new TestReporter();
    this.log = getLogger();
  }

  async initialize() {
    this.browserManager = new BrowserManager(this.config);
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
  ): Promise<TestResult> {
    this.log.trace("Executing test", {
      name: test.name,
      filePath: test.filePath,
      payload: test.payload,
    });
    // If it's direct execution, skip AI
    if (test.directExecution) {
      try {
        const testContext = await this.createTestContext(context);
        await test.fn?.(testContext);
        return {
          test,
          status: "passed",
          reason: "Direct execution successful",
          tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
        };
      } catch (error) {
        return {
          test,
          status: "failed",
          reason:
            error instanceof Error ? error.message : "Direct execution failed",
          tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
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

    const testCache = new TestCache(test);
    if (this.config.caching.enabled) {
      try {
        this.log.setGroup("💾");
        this.log.trace("Checking for cached test");
        await testCache.initialize();
        const cachedEntry = await testCache.get();
        if (cachedEntry) {
          try {
            const result = await this.runCachedTest(
              test,
              browserTool,
              cachedEntry,
            );
            if (test.afterFn) {
              try {
                await test.afterFn(testContext);
              } catch (error) {
                return {
                  test,
                  status: "failed",
                  reason:
                    result?.status === "failed"
                      ? `AI: ${result.reason}, After: ${
                          error instanceof Error ? error.message : String(error)
                        }`
                      : error instanceof Error
                        ? error.message
                        : String(error),
                  tokenUsage: {
                    completionTokens: 0,
                    promptTokens: 0,
                    totalTokens: 0,
                  },
                };
              }
            }
            return {
              ...result,
              tokenUsage: {
                completionTokens: 0,
                promptTokens: 0,
                totalTokens: 0,
              },
            };
          } catch (error) {
            this.log.error(
              "Failed to read cached test",
              getErrorDetails(error),
            );
            // delete stale cache file
            await testCache.delete();
            // reset window state
            const page = browserTool.getPage();
            await page.goto(initialState.metadata?.window_info?.url!);
            await this.executeTest(test, context);
          }
        }
      } finally {
        this.log.resetGroup();
      }
    }

    // Execute before function if present
    if (test.beforeFn) {
      try {
        await test.beforeFn(testContext);
      } catch (error) {
        return {
          test,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
          tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
        };
      }
    }

    let aiResponse: AIClientResponse;
    try {
      this.log.setGroup("🤖");
      const aiClient = new AIClient({ browserTool, testCache });
      aiResponse = await aiClient.runAction(prompt);
    } finally {
      this.log.resetGroup();
    }

    if (test.afterFn) {
      try {
        await test.afterFn(testContext);
      } catch (error) {
        return {
          test,
          status: "failed",
          reason:
            aiResponse.response.status === "failed"
              ? `AI: ${aiResponse.response.reason}, After: ${
                  error instanceof Error ? error.message : String(error)
                }`
              : error instanceof Error
                ? error.message
                : String(error),
          tokenUsage: aiResponse.metadata.usage,
        };
      }
    }

    return {
      test,
      status: aiResponse.response.status,
      reason: aiResponse.response.reason,
      tokenUsage: aiResponse.metadata.usage,
    };
  }

  private async executeTestFile(file: string) {
    try {
      const registry = (global as any).__shortest__.registry;
      registry.tests.clear();
      registry.currentFileTests = [];

      const filePathWithoutCwd = file.replace(this.cwd + "/", "");
      const compiledPath = await this.compiler.compileFile(file);
      this.log.trace("Importing compiled file", { compiledPath });
      await import(pathToFileURL(compiledPath).href);

      let context;
      try {
        this.log.trace("Launching browser");
        context = await this.browserManager.launch();
      } catch (error) {
        this.log.error("Browser initialization failed", getErrorDetails(error));
        throw error;
      }
      this.log.trace("Creating test context");
      const testContext = await this.createTestContext(context);

      try {
        // Execute beforeAll hooks with shared context
        for (const hook of registry.beforeAllFns) {
          await hook(testContext);
        }

        this.reporter.onFileStart(
          filePathWithoutCwd,
          registry.currentFileTests.length,
        );

        // Execute tests in order they were defined
        this.log.info(`Running ${registry.currentFileTests.length} test(s)`);
        for (const test of registry.currentFileTests) {
          // Execute beforeEach hooks with shared context
          for (const hook of registry.beforeEachFns) {
            await hook(testContext);
          }

          this.reporter.onTestStart(test);
          const testResult = await this.executeTest(test, context);
          this.reporter.onTestEnd(testResult);

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
        const fileResult: FileResult = {
          filePath: file,
          status: "passed",
          reason: "",
        };
        this.reporter.onFileEnd(fileResult);
      }
    } catch (error) {
      this.testContext = null; // Reset on error
      if (error instanceof Error) {
        const fileResult: FileResult = {
          filePath: file,
          status: "failed",
          reason: error.message,
        };

        this.reporter.onFileEnd(fileResult);
      }
    }
  }

  async execute(testPattern: string): Promise<boolean> {
    this.log.trace("Finding test files", { testPattern });
    const files = await glob(testPattern, {
      cwd: this.cwd,
      absolute: true,
    });
    if (files.length === 0) {
      this.reporter.error(
        "Test Discovery",
        `No test files found matching the pattern ${testPattern}`,
      );
      this.log.error("No test files found matching", {
        pattern: testPattern,
      });
      return false;
    }

    this.reporter.onRunStart(files.length);
    for (const file of files) {
      await this.executeTestFile(file);
    }
    this.reporter.onRunEnd();

    return this.reporter.allTestsPassed();
  }

  private async runCachedTest(
    test: TestFunction,
    browserTool: BrowserTool,
    cachedEntry: CacheEntry,
  ): Promise<TestResult> {
    const steps = cachedEntry.data.steps
      // do not take screenshots in cached mode
      ?.filter(
        (step) =>
          step.action?.input.action !== BrowserActionEnum.Screenshot.toString(),
      );

    if (!steps) {
      this.log.debug("No steps to execute, running test in normal mode");
      return {
        test,
        status: "failed",
        reason: "No steps to execute, running test in normal mode",
        tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
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
          this.log.trace("Component UI elements mismatch", {
            componentStr,
            stepComponentStr: step.extras.componentStr,
          });
          return {
            test,
            status: "failed",
            reason:
              "Component UI elements are different, running test in normal mode",
            tokenUsage: {
              completionTokens: 0,
              promptTokens: 0,
              totalTokens: 0,
            },
          };
        }
      }
      if (step.action?.input) {
        try {
          await browserTool.execute(step.action.input);
        } catch (error) {
          this.log.error("Failed to execute step", {
            input: step.action.input,
            ...getErrorDetails(error),
          });
        }
      }
    }

    this.log.debug("All actions successfully replayed from cache");
    return {
      test,
      status: "passed",
      reason: "All actions successfully replayed from cache",
      tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
    };
  }
}
