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
import { TestCase } from "@/core/runner/test-case";
import {
  EXPRESSION_PLACEHOLDER,
  parseShortestTestFile,
} from "@/core/runner/test-file-parser";
import { TestReporter } from "@/core/runner/test-reporter";
import { getLogger, Log } from "@/log";
import { TestContext, InternalActionEnum, ShortestStrictConfig } from "@/types";
import { TokenUsageSchema } from "@/types/ai";
import {
  CacheError,
  getErrorDetails,
  ShortestError,
  asShortestError,
} from "@/utils/errors";

const testStatusSchema = z.enum(["pending", "running", "passed", "failed"]);
export type TestStatus = z.infer<typeof testStatusSchema>;

export const TestResultSchema = z.object({
  test: z.any() as z.ZodType<TestCase>,
  status: testStatusSchema,
  reason: z.string(),
  tokenUsage: TokenUsageSchema,
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const FileResultSchema = z.object({
  filePath: z.string(),
  status: testStatusSchema,
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
      // Create a properly typed Playwright object
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
    test: TestCase,
    context: BrowserContext,
    skipCache: boolean = false,
  ): Promise<TestResult> {
    this.log.trace("Executing test", {
      name: test.name,
      filePath: test.filePath,
      payload: test.payload,
      skipCache,
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

    const testCache = new TestCache(test);
    await testCache.initialize();
    if (this.config.caching.enabled && !skipCache) {
      try {
        const result = await this.runCachedTest(test, browserTool, testCache);
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
        if (!(error instanceof CacheError)) throw error;
        this.log.error(
          "Cache execution interrupted, falling back to normal execution",
          getErrorDetails(error),
        );
        if (error.type !== "not-found") {
          await testCache.delete();
        }
        const page = browserTool.getPage();
        await page.goto(initialState.metadata?.window_info?.url!);
        return await this.executeTest(test, context, true);
      }
    } else {
      this.log.trace("Skipping cache", {
        cachingEnabled: this.config.caching.enabled,
        skipCache,
      });
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

  private async filterTestsByLineNumber(
    tests: TestCase[],
    file: string,
    lineNumber: number,
  ): Promise<TestCase[]> {
    const testLocations = parseShortestTestFile(file);
    const escapeRegex = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const filteredTests = tests.filter((test) => {
      const testNameNormalized = test.name.trim();
      let testLocation = testLocations.find(
        (location) => location.testName === testNameNormalized,
      );

      if (!testLocation) {
        testLocation = testLocations.find((location) => {
          const TEMP_TOKEN = "##PLACEHOLDER##";
          let pattern = location.testName.replace(
            new RegExp(escapeRegex(EXPRESSION_PLACEHOLDER), "g"),
            TEMP_TOKEN,
          );

          pattern = escapeRegex(pattern);
          pattern = pattern.replace(new RegExp(TEMP_TOKEN, "g"), ".*");
          const regex = new RegExp(`^${pattern}$`);

          return regex.test(testNameNormalized);
        });
      }

      if (!testLocation) {
        return false;
      }

      const isInRange =
        lineNumber >= testLocation.startLine &&
        lineNumber <= testLocation.endLine;
      return isInRange;
    });

    return filteredTests;
  }

  private async executeTestFile(filePath: string, lineNumber?: number) {
    const registry = (global as any).__shortest__.registry;
    try {
      this.log.trace("Executing test file", { filePath, lineNumber });
      registry.tests.clear();
      registry.currentFileTests = [];
      const filePathWithoutCwd = filePath.replace(this.cwd + "/", "");
      registry.currentFilePath = filePathWithoutCwd;
      const compiledPath = await this.compiler.compileFile(filePath);

      this.log.trace("Importing compiled file", { compiledPath });
      await import(pathToFileURL(compiledPath).href);
      let testsToRun = registry.currentFileTests;

      if (lineNumber) {
        testsToRun = await this.filterTestsByLineNumber(
          registry.currentFileTests,
          filePath,
          lineNumber,
        );
        if (testsToRun.length === 0) {
          this.reporter.error(
            "Test Discovery",
            `No test found at line ${lineNumber} in ${filePathWithoutCwd}`,
          );
          process.exit(1);
        }
      }
      let context;
      try {
        this.log.trace("Launching browser");
        context = await this.browserManager.launch();
      } catch (error) {
        this.log.error("Browser launching failed", getErrorDetails(error));
        throw asShortestError(error);
      }
      this.log.trace("Creating test context");
      const testContext = await this.createTestContext(context);

      try {
        // Execute beforeAll hooks with shared context
        for (const hook of registry.beforeAllFns) {
          await hook(testContext);
        }

        this.reporter.onFileStart(filePathWithoutCwd, testsToRun.length);

        // Execute tests in order they were defined
        this.log.info(`Running ${testsToRun.length} test(s)`);
        for (const test of testsToRun) {
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
          filePath,
          status: "passed",
          reason: "",
        };
        this.reporter.onFileEnd(fileResult);
      }
    } catch (error) {
      this.log.trace("Handling error for executeTestFile");
      if (!(error instanceof ShortestError)) throw error;
      const fileResult: FileResult = {
        filePath,
        status: "failed",
        reason: error.message,
      };
      this.reporter.onFileEnd(fileResult);
    } finally {
      registry.currentFilePath = "";
      this.testContext = null;
    }
  }

  async execute(testPattern: string, lineNumber?: number): Promise<boolean> {
    this.log.trace("Finding test files", { testPattern });

    const files = await glob(testPattern, {
      cwd: this.cwd,
      absolute: true,
    });
    this.log.trace("Found test files", { files });

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
      await this.executeTestFile(file, lineNumber);
    }
    this.reporter.onRunEnd();

    return this.reporter.allTestsPassed();
  }

  private async runCachedTest(
    test: TestCase,
    browserTool: BrowserTool,
    testCache: TestCache,
  ): Promise<TestResult> {
    try {
      this.log.setGroup("💾");
      this.log.trace("Executing test from cache");
      const cachedEntry = await testCache.get();
      if (!cachedEntry) {
        throw new CacheError("not-found", "No cache found");
      }
      const steps = cachedEntry.data.steps
        // do not take screenshots in cached mode
        ?.filter(
          (step) =>
            step.action?.input.action !==
            InternalActionEnum.SCREENSHOT.toString(),
        );

      if (!steps || steps.length === 0) {
        throw new CacheError("invalid", "No eligible steps in cache");
      }

      this.log.trace("Executing cached steps", { stepCount: steps.length });
      for (const step of steps) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (
          step.action?.input.action === InternalActionEnum.MOUSE_MOVE &&
          step.action.input.coordinate
        ) {
          const [x, y] = step.action.input.coordinate;
          const componentStr =
            await browserTool.getNormalizedComponentStringByCoords(x, y);

          if (componentStr !== step.extras.componentStr) {
            this.log.trace("UI element mismatch with cached UI element", {
              componentStr,
              stepComponentStr: step.extras.componentStr,
            });
            throw new CacheError("invalid", "UI element mismatch");
          }
        }

        if (step.action?.input) {
          try {
            await browserTool.execute(step.action.input);
          } catch (error) {
            this.log.error("Failed to execute cached step", {
              input: step.action.input,
              ...getErrorDetails(error),
            });
            throw new CacheError("invalid", "Error executing cached step");
          }
        }
      }

      this.log.debug("Successfully executed all cached steps");
      return {
        test,
        status: "passed",
        reason: "All actions successfully replayed from cache",
        tokenUsage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
      };
    } finally {
      this.log.resetGroup();
    }
  }
}
