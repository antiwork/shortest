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
 * const testRun = TestRun.create(testCase);
 * testRun.markRunning();
 * testRun.markPassed({ reason: "Test passed" });
 * ```
 *
 * @see {@link TestCase} for test case structure
 * @see {@link TokenUsage} for token tracking
 */
export class TestRun {
  /**
   * Creates a new TestRun instance from a test case
   * @param {TestCase} testCase - The test case to be executed
   * @returns {TestRun} A new TestRun instance with pending status
   */
  public static create(testCase: TestCase): TestRun {
    const log = getLogger();
    const startedAt = new Date();
    const timestamp = startedAt.getTime();
    const formattedStartedAt = startedAt.toISOString().replace(/[:.]/g, "-");
    const runId = `${formattedStartedAt}_${testCase.identifier}`;

    log.trace("Creating TestRun", {
      runId,
    });
    return new TestRun(testCase, {
      runId,
      timestamp,
      executedFromCache: false,
    });
  }

  /**
   * Creates a TestRun instance from a cache entry
   * @param {TestCase} testCase - The test case associated with this run
   * @param {CacheEntry} cacheEntry - The cache entry data
   * @returns {TestRun} A new TestRun instance
   *
   * @private
   */
  public static fromCache(testCase: TestCase, cacheEntry: CacheEntry): TestRun {
    const log = getLogger();
    log.trace("Creating TestRun from cache", {
      runId: cacheEntry.metadata.runId,
      stepCount: cacheEntry.data.steps?.length,
    });

    const testRun = new TestRun(testCase, {
      runId: cacheEntry.metadata.runId,
      timestamp: cacheEntry.metadata.timestamp,
      executedFromCache: cacheEntry.metadata.executedFromCache,
    });

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
    return testRun;
  }

  public readonly testCase: TestCase;
  public readonly log: Log;
  public readonly runId: string;
  public readonly timestamp: number;

  public steps: CacheStep[] = [];
  public tokenUsage: TokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  public version: number = TestRunRepository.VERSION;

  private _executedFromCache: boolean = false;
  private state: TestRunState = { status: "pending" } as TestRunState;

  private constructor(
    testCase: TestCase,
    {
      runId,
      timestamp,
      executedFromCache,
    }: { runId: string; timestamp: number; executedFromCache: boolean },
  ) {
    this.testCase = testCase;
    this.log = getLogger();
    this.runId = runId;
    this.timestamp = timestamp;
    this._executedFromCache = executedFromCache;
  }

  /**
   * Gets whether this test run was executed from cache
   * @returns {boolean} True if executed from cache, false otherwise
   */
  get executedFromCache() {
    return this._executedFromCache;
  }

  /**
   * Gets the reason for the current test status
   * @returns {string|undefined} The reason string or undefined if not set
   */
  get reason() {
    return this.state.reason;
  }

  /**
   * Gets the current test status
   * @returns {TestStatus} The current status of the test
   */
  get status() {
    return this.state.status;
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
   * Marks the test run as passed when it used a cached test run to be executed
   * @param {Object} options - Options
   * @param {string} options.reason - Reason for passing
   */
  markPassedFromCache({ reason }: { reason: string }) {
    this.markPassed({ reason });
    // Used for transient test runs that are executed from cache so that
    // are not saved to the cache, as their steps are not valid to be
    // used in a future test run.
    this._executedFromCache = true;
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

  /**
   * Adds a step to the test run
   * @param {CacheStep} step - The step to add to the test run
   */
  public addStep(step: CacheStep): void {
    this.steps.push(step);
  }

  /**
   * Gets all steps in this test run
   * @returns {CacheStep[]} A copy of the steps array
   */
  public getSteps(): CacheStep[] {
    // Return a copy to prevent direct mutation
    return [...this.steps];
  }
}
