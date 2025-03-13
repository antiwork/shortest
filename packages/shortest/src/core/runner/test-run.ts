import path from "path";
import { CACHE_DIR_PATH } from "@/cache";
import { TestStatus } from "@/core/runner";
import { TestCase } from "@/core/runner/test-case";
import { TokenUsage } from "@/types/ai";
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
  private readonly testCase: TestCase;
  private state: TestRunState = { status: "pending" } as TestRunState;

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
  private cacheKey: string;
  private cacheFileName: string;
  private cacheDir: string;

  /**
   * Creates a new test run instance
   * @param {TestCase} testCase - Test case to execute
   *
   * @private
   */
  constructor(testCase: TestCase) {
    this.testCase = testCase;
    const startedAt = new Date();
    const formattedStartedAt = startedAt.toISOString().replace(/[:.]/g, "-");
    this.cacheKey = `${formattedStartedAt}_${this.testCase.identifier}`;
    this.cacheFileName = `${this.cacheKey}.json`;
    this.cacheDir = path.join(CACHE_DIR_PATH, this.cacheKey);
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
}
