import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestRunner } from ".";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { writeFailureReport } from "@/report/failure-report-writer";

vi.mock("@/report/failure-report-writer", () => ({
  writeFailureReport: vi.fn(),
}));

vi.mock("@/log", () => ({
  Log: vi.fn().mockImplementation(() => ({
    error: vi.fn(),
    info: vi.fn(),
    resetGroup: vi.fn(),
    setGroup: vi.fn(),
  })),
  getLogger: vi.fn(() => ({
    config: {},
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    resetGroup: vi.fn(),
    setGroup: vi.fn(),
    trace: vi.fn(),
  })),
}));

describe("TestRunner failure reports", () => {
  const config = {
    ai: {
      apiKey: "test-key",
      model: "claude-4-sonnet-20250514",
      provider: "anthropic",
    },
    baseUrl: "https://example.com",
    browser: {},
    caching: { enabled: true },
    headless: true,
    testPattern: "**/*.test.ts",
  } as any;

  const createRun = (status: "failed" | "passed") => {
    const testCase = createTestCase({
      filePath: "tests/login.test.ts",
      name: "Login test",
    });
    const testRun = TestRun.create(testCase);
    testRun.markRunning();

    if (status === "failed") {
      testRun.markFailed({ reason: "password=hunter2" });
    } else {
      testRun.markPassed({ reason: "ok" });
    }

    return testRun;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not write reports when disabled", async () => {
    const runner = new TestRunner("/repo", config, {
      report: { enabled: false, outputDir: "reports" },
    });

    await (runner as any).writeFailureReport(createRun("failed"));

    expect(writeFailureReport).not.toHaveBeenCalled();
  });

  it("does not write reports for passed tests", async () => {
    const runner = new TestRunner("/repo", config, {
      report: { enabled: true, outputDir: "reports" },
    });

    await (runner as any).writeFailureReport(createRun("passed"));

    expect(writeFailureReport).not.toHaveBeenCalled();
  });

  it("writes reports for failed tests and prints the report path", async () => {
    vi.mocked(writeFailureReport).mockResolvedValue("reports/run.md");

    const runner = new TestRunner("/repo", config, {
      report: { enabled: true, outputDir: "reports" },
    });
    const reporterInfo = vi
      .spyOn((runner as any).reporter, "info")
      .mockImplementation(() => undefined);
    const testRun = createRun("failed");

    await (runner as any).writeFailureReport(testRun);

    expect(writeFailureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "tests/login.test.ts",
        reason: "password=hunter2",
        runId: testRun.runId,
        screenshotSourceDir: path.join(
          "/repo",
          ".shortest",
          "cache",
          testRun.runId,
        ),
        testName: "Login test",
      }),
      {
        cwd: "/repo",
        enabled: true,
        outputDir: "reports",
      },
    );
    expect(reporterInfo).toHaveBeenCalledWith(
      "Failure report written: reports/run.md",
    );
  });

  it("reports writer failures without throwing", async () => {
    vi.mocked(writeFailureReport).mockRejectedValue(new Error("disk full"));

    const runner = new TestRunner("/repo", config, {
      report: { enabled: true, outputDir: "reports" },
    });
    const reporterError = vi
      .spyOn((runner as any).reporter, "error")
      .mockImplementation(() => undefined);

    await expect(
      (runner as any).writeFailureReport(createRun("failed")),
    ).resolves.toBeUndefined();
    expect(reporterError).toHaveBeenCalledWith("Failure report", "disk full");
  });
});
