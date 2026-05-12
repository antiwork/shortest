import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFailureReport } from "./failure-report-writer";
import type { FailureReportInput } from "./types";

const input: FailureReportInput = {
  runId: "Run ABC 123",
  testName: "Login",
  filePath: "app/login.test.ts",
  reason: "Bad token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
  steps: [],
};

describe("writeFailureReport", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shortest-report-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { force: true, recursive: true });
  });

  it("returns null when reports are disabled", async () => {
    await expect(
      writeFailureReport(input, {
        cwd: tempDir,
        enabled: false,
        outputDir: "reports",
      }),
    ).resolves.toBeNull();
  });

  it("writes redacted markdown with a safe run id file name", async () => {
    const reportPath = await writeFailureReport(input, {
      cwd: tempDir,
      enabled: true,
      outputDir: "reports",
    });

    expect(reportPath).toBe("reports/run-abc-123.md");

    const content = await fs.readFile(path.join(tempDir, reportPath!), "utf-8");
    expect(content).toContain("# Shortest failure report");
    expect(content).not.toContain("ghp_");
    expect(content).toContain("[REDACTED:token]");
  });

  it("copies screenshots into the report bundle and links them", async () => {
    const screenshotSourceDir = path.join(tempDir, "cache", "run");
    await fs.mkdir(screenshotSourceDir, { recursive: true });
    await fs.writeFile(
      path.join(screenshotSourceDir, "screenshot-2026.png"),
      "fake image",
    );
    await fs.writeFile(
      path.join(screenshotSourceDir, "not-a-screenshot.txt"),
      "x",
    );

    const reportPath = await writeFailureReport(
      {
        ...input,
        screenshotSourceDir,
      },
      {
        cwd: tempDir,
        enabled: true,
        outputDir: "reports",
      },
    );

    const copiedScreenshotPath = path.join(
      tempDir,
      "reports",
      "run-abc-123",
      "screenshots",
      "screenshot-2026.png",
    );
    const content = await fs.readFile(path.join(tempDir, reportPath!), "utf-8");

    await expect(fs.readFile(copiedScreenshotPath, "utf-8")).resolves.toBe(
      "fake image",
    );
    expect(content).toContain(
      "![Screenshot 1](run-abc-123/screenshots/screenshot-2026.png)",
    );
    await expect(
      fs.readFile(
        path.join(
          tempDir,
          "reports",
          "run-abc-123",
          "screenshots",
          "not-a-screenshot.txt",
        ),
        "utf-8",
      ),
    ).rejects.toThrow();
  });

  it("handles missing screenshot directories", async () => {
    const reportPath = await writeFailureReport(
      {
        ...input,
        screenshotSourceDir: path.join(tempDir, "missing"),
      },
      {
        cwd: tempDir,
        enabled: true,
        outputDir: "reports",
      },
    );

    const content = await fs.readFile(path.join(tempDir, reportPath!), "utf-8");
    expect(content).toContain("No screenshots recorded.");
  });
});
