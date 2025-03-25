import { pathToFileURL } from "url";
import { glob } from "glob";
import { APIRequest, BrowserContext } from "playwright";
import * as playwright from "playwright";
import { request, APIRequestContext } from "playwright";
import { z } from "zod";
import { AIClient, AIClientResponse } from "@/ai/client";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BrowserManager } from "@/browser/manager";
import { TestCompiler } from "@/core/compiler";
import { TestCase } from "@/core/runner/test-case";
import {
  EXPRESSION_PLACEHOLDER,
  parseShortestTestFile,
} from "@/core/runner/test-file-parser";
import { TestReporter } from "@/core/runner/test-reporter";
import { TestRun } from "@/core/runner/test-run";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { getLogger, Log } from "@/log";
import {
  TestContext,
  InternalActionEnum,
  ShortestStrictConfig,
  TestFileContext,
} from "@/types";
import { assertDefined } from "@/utils/assert";
import {
  CacheError,
  getErrorDetails,
  ShortestError,
  asShortestError,
} from "@/utils/errors";
const testStatusSchema = z.enum(["pending", "running", "passed", "failed"]);
export type TestStatus = z.infer<typeof testStatusSchema>;

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
  private testFileContext: TestFileContext | null = null;
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
        `No test files found matching the test pattern ${testPattern}`,
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

  private async executeTest(
    testRun: TestRun,
    context: BrowserContext,
    skipCache: boolean = false,
  ): Promise<TestRun> {
    const testCase = testRun.testCase;
    this.log.trace("Executing test", {
      name: testCase.name,
      filePath: testCase.filePath,
      payload: testCase.payload,
      skipCache,
    });
    // If it's direct execution, skip AI
    if (testCase.directExecution) {
      try {
        const testContext = await this.createTestContext(testRun);
        await testCase.fn?.(testContext);
        testRun.markPassed({ reason: "Direct execution successful" });
        return testRun;
      } catch (error) {
        testRun.markFailed({
          reason:
            error instanceof Error ? error.message : "Direct execution failed",
        });
        return testRun;
      }
    }

    const testContext = await this.createTestContext(testRun);
    const browserTool = new BrowserTool(testContext.page, this.browserManager, {
      width: 1920,
      height: 1080,
      testContext: {
        ...testContext,
        testRun: testRun,
        currentStepIndex: 0,
      },
    });

    const initialState = await browserTool.execute({
      action: "screenshot",
    });

    if (this.config.caching.enabled && !skipCache) {
      try {
        await this.runCachedTest(testRun, browserTool);
        if (testCase.afterFn) {
          try {
            await testCase.afterFn(testContext);
          } catch (error) {
            testRun.markFailed({
              reason:
                testRun.status === "failed"
                  ? `AI: ${testRun.reason}, After: ${
                      error instanceof Error ? error.message : String(error)
                    }`
                  : error instanceof Error
                    ? error.message
                    : String(error),
            });
          }
        }
        return testRun;
      } catch (error) {
        if (!(error instanceof CacheError)) throw error;
        this.log.error(
          "Cache execution interrupted, falling back to normal execution",
          getErrorDetails(error),
        );
        const page = browserTool.getPage();
        await page.goto(initialState.metadata?.window_info?.url!);
        return await this.executeTest(testRun, context, true);
      }
    } else {
      this.log.trace("Skipping cache", {
        cachingEnabled: this.config.caching.enabled,
        skipCache,
      });
    }

    if (testCase.beforeFn) {
      try {
        await testCase.beforeFn(testContext);
      } catch (error) {
        testRun.markFailed({
          reason: error instanceof Error ? error.message : String(error),
        });
        return testRun;
      }
    }

    let aiResponse: AIClientResponse;
    try {
      this.log.setGroup("🤖");
      // Build prompt with initial state and screenshot
      const prompt = [
        `Test: "${testCase.name}"`,
        testCase.payload ? `Context: ${JSON.stringify(testCase.payload)}` : "",
        `Callback function: ${testCase.fn ? " [HAS_CALLBACK]" : " [NO_CALLBACK]"}`,

        // Add expectations if they exist
        ...(testCase.expectations?.length
          ? [
              "\nExpect:",
              ...testCase.expectations.map(
                (exp, i) =>
                  `${i + 1}. ${exp.description}${
                    exp.fn ? " [HAS_CALLBACK]" : "[NO_CALLBACK]"
                  }`,
              ),
            ]
          : ["\nExpect:", `1. "${testCase.name}" expected to be successful`]),

        "\nCurrent Page State:",
        `URL: ${initialState.metadata?.window_info?.url || "unknown"}`,
        `Title: ${initialState.metadata?.window_info?.title || "unknown"}`,
      ]
        .filter(Boolean)
        .join("\n");
      const aiClient = new AIClient({ browserTool, testRun });
      aiResponse = await aiClient.runAction(prompt);
    } finally {
      this.log.resetGroup();
    }

    if (testCase.afterFn) {
      try {
        await testCase.afterFn(testContext);
      } catch (error) {
        testRun.markFailed({
          reason:
            aiResponse.response.status === "failed"
              ? `AI: ${aiResponse.response.reason}, After: ${
                  error instanceof Error ? error.message : String(error)
                }`
              : error instanceof Error
                ? error.message
                : String(error),
          tokenUsage: aiResponse.metadata.usage,
        });
        return testRun;
      }
    }
    switch (aiResponse.response.status) {
      case "passed":
        testRun.markPassed({
          reason: aiResponse.response.reason,
          tokenUsage: aiResponse.metadata.usage,
        });
        break;
      case "failed":
        testRun.markFailed({
          reason: aiResponse.response.reason,
          tokenUsage: aiResponse.metadata.usage,
        });
        break;
      default:
        throw new ShortestError(
          `Unexpected AI response status: ${aiResponse.response.status}`,
        );
    }
    return testRun;
  }

  private async runCachedTest(
    testRun: TestRun,
    browserTool: BrowserTool,
  ): Promise<TestRun> {
    try {
      this.log.setGroup("💾");
      this.log.trace("Attempting to execute test from cache", {
        identifier: testRun.testCase.identifier,
      });

      const latestRun = await TestRunRepository.getRepositoryForTestCase(
        testRun.testCase,
      ).getLatestPassedRun();
      if (!latestRun) {
        throw new CacheError(
          "not-found",
          "No successful cached test run found",
        );
      }
      const filteredSteps = latestRun.steps
        // Do not take screenshots in cached mode
        ?.filter(
          (step) =>
            step.action?.input.action !==
            InternalActionEnum.SCREENSHOT.toString(),
        );

      this.log.trace("Using cached test run", {
        runId: latestRun.runId,
        stepCount: latestRun.steps.length,
        filteredStepCount: filteredSteps.length,
      });

      if (!filteredSteps || filteredSteps.length === 0) {
        throw new CacheError("invalid", "No eligible steps in cache");
      }

      for (const step of filteredSteps) {
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
      testRun.markPassedFromCache({
        reason: "All actions successfully replayed from cache",
      });
      return testRun;
    } finally {
      this.log.resetGroup();
    }
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
          throw new ShortestError(
            `No test found at line ${lineNumber} in ${filePathWithoutCwd}`,
          );
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
      const testContext = await this.createFileTestContext(context);

      try {
        // Execute beforeAll hooks with shared context
        for (const hook of registry.beforeAllFns) {
          await hook(testContext);
        }

        this.reporter.onFileStart(filePathWithoutCwd, testsToRun.length);

        // Execute tests in order they were defined
        this.log.info(`Running ${testsToRun.length} test(s)`);
        for (const testCase of testsToRun) {
          // Execute beforeEach hooks with shared context
          for (const hook of registry.beforeEachFns) {
            await hook(testContext);
          }

          this.reporter.onTestStart(testCase);
          const testRun = TestRun.create(testCase);
          try {
            testRun.markRunning();
            await this.executeTest(testRun, context);
          } catch (error) {
            this.log.error(
              "Handling error for executeTest",
              getErrorDetails(error),
            );
            throw error;
          }
          this.reporter.onTestEnd(testRun);

          for (const hook of registry.afterEachFns) {
            await hook(testContext);
          }

          await TestRunRepository.getRepositoryForTestCase(testCase).saveRun(
            testRun,
          );

          try {
            await TestRunRepository.getRepositoryForTestCase(
              testCase,
            ).applyRetentionPolicy();
          } catch (error) {
            this.log.error(
              "Failed to apply retention policy",
              getErrorDetails(error),
            );
          }
        }

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

  private async createFileTestContext(
    context: BrowserContext,
  ): Promise<TestFileContext> {
    if (!this.testFileContext) {
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

      this.testFileContext = {
        page: context.pages()[0],
        browser: this.browserManager.getBrowser()!,
        playwright: playwrightObj,
      };
    }
    return this.testFileContext;
  }

  private async createTestContext(testRun: TestRun): Promise<TestContext> {
    if (this.testContext) return this.testContext;

    return { ...assertDefined(this.testFileContext), testRun };
  }
}
