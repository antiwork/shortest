import { describe, test, expect } from "vitest";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";

describe("test-run", () => {
  const mockTestCase = createTestCase({
    name: "test case",
    filePath: "/test.ts",
  });

  test("initializes with pending status", () => {
    const testRun = new TestRun(mockTestCase);
    expect(testRun.status).toBe("pending");
    expect(testRun.reason).toBeUndefined();
  });

  test("transitions from pending to running", () => {
    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    expect(testRun.status).toBe("running");
    expect(testRun.reason).toBeUndefined();
  });

  test("transitions from running to passed", () => {
    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    testRun.markPassed({ reason: "test passed" });
    expect(testRun.status).toBe("passed");
    expect(testRun.reason).toBe("test passed");
  });

  test("transitions from running to failed", () => {
    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    testRun.markFailed({ reason: "test failed" });
    expect(testRun.status).toBe("failed");
    expect(testRun.reason).toBe("test failed");
  });

  test("tracks token usage", () => {
    const testRun = new TestRun(mockTestCase);
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
    const testRun = new TestRun(mockTestCase);
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
    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    expect(() => testRun.markRunning()).toThrow(
      "Can only start from pending state",
    );
  });

  test("throws when marking passed from non-running state", () => {
    const testRun = new TestRun(mockTestCase);
    expect(() => testRun.markPassed({ reason: "test passed" })).toThrow(
      "Can only pass from running state",
    );
  });
});
