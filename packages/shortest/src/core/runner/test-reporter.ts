import pc from "picocolors";
import { FileResult, TestStatus } from "@/core/runner/index";
import { TestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { getLogger, Log } from "@/log/index";
import { AssertionError } from "@/types/test";

export class TestReporter {
  private startTime: number = Date.now();
  private reporterLog: Log;
  private log: Log;

  // token pricing (Claude 3.5 Sonnet)
  private readonly COST_PER_1K_PROMPT_TOKENS = 0.003;
  private readonly COST_PER_1K_COMPLETION_TOKENS = 0.015;

  private filesCount: number = 0;
  private testsCount: number = 0;
  private passedTestsCount: number = 0;
  private failedTestsCount: number = 0;
  private totalPromptTokens: number = 0;
  private totalCompletionTokens: number = 0;
  private aiCost: number = 0;

  constructor() {
    this.reporterLog = getReporterLog();
    this.log = getLogger();
  }

  onRunStart(filesCount: number) {
    this.filesCount = filesCount;
    this.reporterLog.info(`Found ${filesCount} test file(s)`);
  }

  onFileStart(filePath: string, testsCount: number) {
    this.log.setGroup(filePath);
    this.reporterLog.info(
      pc.cyan("❯"),
      pc.blue(pc.bold(filePath)),
      pc.dim(`(${testsCount})`),
    );
    this.reporterLog.setGroup(filePath);
    this.testsCount += testsCount;
  }

  onTestStart(test: TestCase) {
    this.log.trace("onTestStart called");
    this.log.setGroup(test.name);
    this.reporterLog.info(this.getStatusIcon("running"), test.name);
    this.reporterLog.setGroup(test.name);
  }

  onTestEnd(testRun: TestRun) {
    this.log.trace("onTestEnd called");
    switch (testRun.status) {
      case "passed":
        this.passedTestsCount++;
        break;
      case "failed":
        this.failedTestsCount++;
        break;
    }
    let testAICost = 0;
    if (testRun.tokenUsage) {
      this.totalPromptTokens += testRun.tokenUsage.promptTokens;
      this.totalCompletionTokens += testRun.tokenUsage.completionTokens;
      testAICost = this.calculateCost(
        testRun.tokenUsage.promptTokens,
        testRun.tokenUsage.completionTokens,
      );
      this.aiCost += testAICost;
    }
    const symbol = testRun.status === "passed" ? "✓" : "✗";
    const color = testRun.status === "passed" ? pc.green : pc.red;

    this.reporterLog.info(`${color(`${symbol} ${testRun.status}`)}`);
    if (testRun.tokenUsage.totalTokens > 0) {
      const cost = this.calculateCost(
        testRun.tokenUsage.promptTokens,
        testRun.tokenUsage.completionTokens,
      );
      this.reporterLog.info(
        pc.dim("↳"),
        pc.dim(`${testRun.tokenUsage.totalTokens.toLocaleString()} tokens`),
        pc.dim(`(≈ $${cost.toFixed(2)})`),
      );
    }

    if (testRun.status === "failed") {
      this.error("Reason", testRun.reason!);
    }

    this.reporterLog.resetGroup();
    this.log.resetGroup();
  }

  onFileEnd(fileResult: FileResult) {
    if (fileResult.status === "failed") {
      this.log.error("Error processing file", { ...fileResult });
      this.error("Error processing file", fileResult.reason);
    }
    this.reporterLog.resetGroup();
    this.log.resetGroup();
  }

  onRunEnd() {
    this.summary();
  }

  allTestsPassed(): boolean {
    return this.testsCount === this.passedTestsCount;
  }

  error(context: string, message: string) {
    this.reporterLog.error(pc.red(`${context}: ${message}`));
  }

  reportAssertion(
    step: string,
    status: "passed" | "failed",
    error?: AssertionError,
  ): void {
    if (status === "passed") {
      this.reporterLog.error(pc.green(`✓ ${step}`));
    } else {
      this.reporterLog.error(pc.red(`✗ ${step}`));
      if (error) {
        this.reporterLog.error(pc.dim(error.message));
      }
    }
  }

  private calculateCost(
    promptTokens: number,
    completionTokens: number,
  ): number {
    const promptTokensCost =
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS;
    const completionTokensCost =
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS;
    return Math.round((promptTokensCost + completionTokensCost) * 1000) / 1000;
  }

  private getStatusIcon(status: TestStatus): string {
    switch (status) {
      case "pending":
        return pc.yellow("○");
      case "running":
        return pc.cyan("●");
      case "passed":
        return pc.green("✓");
      case "failed":
        return pc.red("✗");
    }
  }

  private summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    const aiCost = this.calculateCost(
      this.totalPromptTokens,
      this.totalCompletionTokens,
    );

    this.reporterLog.setGroup("Summary");
    this.reporterLog.info(pc.dim("⎯".repeat(50)), "\n");

    const LABEL_WIDTH = 15;
    this.reporterLog.info(
      pc.bold(" Tests".padEnd(LABEL_WIDTH)),
      this.failedTestsCount
        ? `${pc.red(`${this.failedTestsCount} failed`)} | ${pc.green(`${this.passedTestsCount} passed`)}`
        : pc.green(`${this.passedTestsCount} passed`),
      pc.dim(`(${this.testsCount})`),
    );

    this.reporterLog.info(
      pc.bold(" Duration".padEnd(LABEL_WIDTH)),
      pc.dim(`${duration}s`),
    );
    this.reporterLog.info(
      pc.bold(" Started at".padEnd(LABEL_WIDTH)),
      pc.dim(new Date(this.startTime).toLocaleTimeString()),
    );
    this.reporterLog.info(
      pc.bold(" Tokens".padEnd(LABEL_WIDTH)),
      pc.dim(
        `${totalTokens.toLocaleString()} tokens ` + `(≈ $${aiCost.toFixed(2)})`,
      ),
    );
    this.reporterLog.info("\n", pc.dim("⎯".repeat(50)));
    this.reporterLog.resetGroup();
  }
}

let reporterLogInstance: Log | null = null;

export const getReporterLog = (): Log => {
  if (reporterLogInstance) {
    return reporterLogInstance;
  }
  reporterLogInstance = new Log({
    level: "info",
    format: "reporter",
  });
  return reporterLogInstance;
};
