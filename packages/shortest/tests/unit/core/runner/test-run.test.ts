import { describe, test, expect } from "vitest";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { CacheEntry, CacheStep } from "@/types/cache";

describe("test-run", () => {
  const mockTestCase = createTestCase({
    name: "test case",
    filePath: "/test.ts",
  });

  test("initializes with pending status", () => {
    const testRun = TestRun.create(mockTestCase);
    expect(testRun.status).toBe("pending");
    expect(testRun.reason).toBeUndefined();
  });

  test("transitions from pending to running", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    expect(testRun.status).toBe("running");
    expect(testRun.reason).toBeUndefined();
  });

  test("transitions from running to passed", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    testRun.markPassed({ reason: "test passed" });
    expect(testRun.status).toBe("passed");
    expect(testRun.reason).toBe("test passed");
  });

  test("transitions from running to failed", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    testRun.markFailed({ reason: "test failed" });
    expect(testRun.status).toBe("failed");
    expect(testRun.reason).toBe("test failed");
  });

  test("tracks token usage", () => {
    const testRun = TestRun.create(mockTestCase);
    const usage = {
      completionTokens: 10,
      promptTokens: 20,
      totalTokens: 30,
    };
    testRun.markRunning();
    testRun.markPassed({ reason: "test passed", tokenUsage: usage });
    expect(testRun.tokenUsage).toEqual(usage);
  });

  test("updates token usage on state change", () => {
    const testRun = TestRun.create(mockTestCase);
    const usage = {
      completionTokens: 10,
      promptTokens: 20,
      totalTokens: 30,
    };
    testRun.markRunning();
    testRun.markPassed({ reason: "test passed", tokenUsage: usage });
    expect(testRun.tokenUsage).toEqual(usage);
  });

  test("throws when marking running from non-pending state", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    expect(() => testRun.markRunning()).toThrow(
      "Can only start from pending state",
    );
  });

  test("throws when marking passed from non-running state", () => {
    const testRun = TestRun.create(mockTestCase);
    expect(() => testRun.markPassed({ reason: "test passed" })).toThrow(
      "Can only pass from running state",
    );
  });

  test("adds and retrieves steps", () => {
    const testRun = TestRun.create(mockTestCase);

    const step1: CacheStep = {
      reasoning: "Navigating to example.com",
      action: {
        type: "tool_use",
        name: "navigate",
        input: {
          action: "navigate",
          url: "https://example.com",
        },
      },
      timestamp: Date.now(),
      result: null,
    };

    const step2: CacheStep = {
      reasoning: "Typing text",
      action: {
        type: "tool_use",
        name: "type",
        input: {
          action: "type",
          text: "test prompt",
        },
      },
      timestamp: Date.now(),
      result: null,
    };

    testRun.addStep(step1);
    testRun.addStep(step2);

    const steps = testRun.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0]).toEqual(step1);
    expect(steps[1]).toEqual(step2);

    // Verify that getSteps returns a copy to prevent direct mutation
    steps.pop();
    expect(testRun.getSteps()).toHaveLength(2);
  });

  test("creates TestRun from cache file", () => {
    const mockTimestamp = 1234567890;
    const mockRunId = "2023-01-01T00-00-00-000Z_test";

    const mockCacheEntry: CacheEntry = {
      metadata: {
        timestamp: mockTimestamp,
        version: TestRunRepository.VERSION,
        status: "passed",
        reason: "from cache",
        tokenUsage: {
          completionTokens: 100,
          promptTokens: 200,
          totalTokens: 300,
        },
        runId: mockRunId,
        executedFromCache: false,
      },
      test: {
        name: mockTestCase.name,
        filePath: mockTestCase.filePath,
      },
      data: {
        steps: [
          {
            reasoning: "Navigating to example.com",
            action: {
              type: "tool_use",
              name: "navigate",
              input: {
                action: "navigate",
                url: "https://example.com",
              },
            },
            timestamp: mockTimestamp,
            result: null,
          },
        ],
      },
    };

    const testRun = TestRun.fromCache(mockTestCase, mockCacheEntry);

    expect(testRun.testCase).toBe(mockTestCase);
    expect(testRun.status).toBe("passed");
    expect(testRun.reason).toBe("from cache");
    expect(testRun.tokenUsage).toEqual(mockCacheEntry.metadata.tokenUsage);
    expect(testRun.runId).toBe(mockRunId);
    expect(testRun.timestamp).toBe(mockTimestamp);
    expect(testRun.version).toBe(TestRunRepository.VERSION);
    expect(testRun.executedFromCache).toBe(false);
    expect(testRun.getSteps()).toEqual(mockCacheEntry.data.steps);
  });

  test("handles version conversion in fromCache", () => {
    const mockCacheEntry: CacheEntry = {
      metadata: {
        timestamp: 1234567890,
        // @ts-ignore
        version: "1",
        status: "passed",
        reason: "test passed",
        tokenUsage: {
          completionTokens: 10,
          promptTokens: 20,
          totalTokens: 30,
        },
        runId: "test-run-id",
        executedFromCache: false,
      },
      test: {
        name: mockTestCase.name,
        filePath: mockTestCase.filePath,
      },
      data: {
        steps: [],
      },
    };

    const testRun = TestRun.fromCache(mockTestCase, mockCacheEntry);
    expect(testRun.version).toBe(1);
  });

  test("markPassedFromCache sets status to passed", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    testRun.markPassedFromCache({ reason: "passed from cache" });
    expect(testRun.status).toBe("passed");
  });

  test("markPassedFromCache sets provided reason", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    const reason = "custom cache reason";
    testRun.markPassedFromCache({ reason });
    expect(testRun.reason).toBe(reason);
  });

  test("markPassedFromCache sets executedFromCache flag to true", () => {
    const testRun = TestRun.create(mockTestCase);
    testRun.markRunning();
    expect(testRun.executedFromCache).toBe(false);
    testRun.markPassedFromCache({ reason: "passed from cache" });
    expect(testRun.executedFromCache).toBe(true);
  });

  test("markPassedFromCache throws when called from non-running state", () => {
    const pendingRun = TestRun.create(mockTestCase);
    expect(() =>
      pendingRun.markPassedFromCache({ reason: "from pending" }),
    ).toThrow("Can only pass from running state");

    const failedRun = TestRun.create(mockTestCase);
    failedRun.markRunning();
    failedRun.markFailed({ reason: "failed first" });
    expect(() =>
      failedRun.markPassedFromCache({ reason: "from failed" }),
    ).toThrow("Can only pass from running state");
  });
});
