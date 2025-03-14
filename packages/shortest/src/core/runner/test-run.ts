import { TestRunRepository } from "./test-run-repository";
import { TestStatus } from "@/core/runner";
import { TestCase } from "@/core/runner/test-case";
import { getLogger, Log } from "@/log";
import { TokenUsage } from "@/types/ai";
import { CacheEntry, CacheStep } from "@/types/cache";
import { ShortestError } from "@/utils/errors";

// eslint-disable-next-line zod/require-zod-schema-types
type TestRunState =
  | { status: Extract<TestStatus, "failed" | "passed">; reason: string }
  | { status: Extract<TestStatus, "pending" | "running">; reason?: string };

/**
 * Represents a single test execution with state management and token tracking.
 *
 * @class
 * @example
 * ```typescript
 * const testRun = new TestRun(testCase);
 * testRun.markRunning();
 * testRun.markPassed({ reason: "Test passed" });
 * ```
 *
 * @see {@link TestCase} for test case structure
 * @see {@link TokenUsage} for token tracking
 */
export class TestRun {
  public readonly testCase: TestCase;
  public readonly log: Log;

  private state: TestRunState = { status: "pending" } as TestRunState;
  public steps: CacheStep[] = [];
  get status() {
    return this.state.status;
  }
  get reason() {
    return this.state.reason;
  }
  public tokenUsage: TokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  public runId: string;
  public version: number = TestRunRepository.VERSION;
  public timestamp: number;
  public fromCache: boolean = false;

  /**
   * Creates a new test run instance
   * @param {TestCase} testCase - Test case to execute
   *
   * @private
   */
  constructor(testCase: TestCase) {
    this.testCase = testCase;
    this.log = getLogger();
    const startedAt = new Date();
    this.timestamp = startedAt.getTime();
    const formattedStartedAt = startedAt.toISOString().replace(/[:.]/g, "-");
    this.runId = `${formattedStartedAt}_${this.testCase.identifier}`;
    this.log.trace("Initializing TestRun", {
      runId: this.runId,
    });
  }

  /**
   * Initializes the cache instance
   * @private
   */
  async initialize(): Promise<void> {
    this.log.trace("TestRun initialized", {
      runId: this.runId,
    });
  }

  /**
   * Marks the test as running
   * @throws {ShortestError} If test is not in pending state
   */
  markRunning() {
    if (this.status !== "pending")
      throw new ShortestError("Can only start from pending state");
    this.state = { status: "running" };
  }

  /**
   * Marks the test as passed
   * @param {Object} options - Pass options
   * @param {string} options.reason - Reason for passing
   * @param {TokenUsage} [options.tokenUsage] - Optional token usage stats
   * @throws {ShortestError} If test is not in running state
   *
   * @private
   */
  markPassed({
    reason,
    tokenUsage,
  }: {
    reason: string;
    tokenUsage?: TokenUsage;
  }) {
    if (this.status !== "running")
      throw new ShortestError("Can only pass from running state");
    this.state = { status: "passed", reason };
    if (tokenUsage) this.tokenUsage = tokenUsage;
  }

  /**
   * Marks the test as failed
   * @param {Object} options - Fail options
   * @param {string} options.reason - Reason for failure
   * @param {TokenUsage} [options.tokenUsage] - Optional token usage stats
   *
   * @private
   */
  markFailed({
    reason,
    tokenUsage,
  }: {
    reason: string;
    tokenUsage?: TokenUsage;
  }) {
    this.state = { status: "failed", reason };
    if (tokenUsage) this.tokenUsage = tokenUsage;
  }

  public addStep(step: CacheStep): void {
    this.steps.push(step);
  }

  public getSteps(): CacheStep[] {
    // Return a copy to prevent direct mutation
    return [...this.steps];
  }

  /**
   * Creates a TestRun instance from a cache file
   * @param {TestCase} testCase - The test case associated with this run
   * @param {string} file - The cache file name
   * @param {CacheEntry} cacheEntry - The cache entry data
   * @returns {TestRun} A new TestRun instance
   *
   * @private
   */
  static fromCacheFile(testCase: TestCase, cacheEntry: CacheEntry): TestRun {
    const testRun = new TestRun(testCase);
    testRun.runId = cacheEntry.metadata.runId;
    testRun.timestamp = cacheEntry.metadata.timestamp;
    testRun.version =
      typeof cacheEntry.metadata.version === "string"
        ? parseInt(cacheEntry.metadata.version, 10) || 0
        : cacheEntry.metadata.version || 0;
    testRun.state = {
      status: cacheEntry.metadata.status,
      reason: cacheEntry.metadata.reason,
    } as TestRunState;
    testRun.tokenUsage = cacheEntry.metadata.tokenUsage;
    if (cacheEntry.data.steps) {
      testRun.steps = [...cacheEntry.data.steps];
    }
    testRun.fromCache = true;
    return testRun;
  }
}
