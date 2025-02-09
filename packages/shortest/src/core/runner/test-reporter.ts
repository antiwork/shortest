import pc from "picocolors";
import { FileResult, TestResult, TestStatus } from "@/core/runner/index";
import { getLogger, Log } from "@/log/index";
import { AssertionError, TestFunction } from "@/types/test";
export class TestReporter {
  private startTime: number = Date.now();
  private reporterLog: Log;
  private log: Log;

  // token pricing (Claude 3.5 Sonnet)
  private readonly COST_PER_1K_INPUT_TOKENS = 0.003;
  private readonly COST_PER_1K_OUTPUT_TOKENS = 0.015;

  private filesCount: number = 0;
  private testsCount: number = 0;
  private passedTestsCount: number = 0;
  private failedTestsCount: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
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

  onTestStart(test: TestFunction) {
    this.log.setGroup(test.name);
    this.reporterLog.info(this.getStatusIcon("running"), test.name);
    this.reporterLog.setGroup(test.name);
  }

  onTestEnd(testResult: TestResult) {
    switch (testResult.status) {
      case "passed":
        this.passedTestsCount++;
        break;
      case "failed":
        this.failedTestsCount++;
        break;
    }
    let testAICost = 0;
    if (testResult.tokenUsage) {
      this.totalInputTokens += testResult.tokenUsage.input;
      this.totalOutputTokens += testResult.tokenUsage.output;
      testAICost = this.calculateCost(
        testResult.tokenUsage.input,
        testResult.tokenUsage.output,
      );
      this.aiCost += testAICost;
    }
    const symbol = testResult.status === "passed" ? "✓" : "✗";
    const color = testResult.status === "passed" ? pc.green : pc.red;

    this.reporterLog.info(`${color(`${symbol} ${testResult.status}`)}`);
    if (testResult.tokenUsage.input > 0 || testResult.tokenUsage.output > 0) {
      const totalTokens =
        testResult.tokenUsage.input + testResult.tokenUsage.output;
      const cost = this.calculateCost(
        testResult.tokenUsage.input,
        testResult.tokenUsage.output,
      );
      this.reporterLog.info(
        pc.dim("↳"),
        pc.dim(`${totalTokens.toLocaleString()} tokens`),
        pc.dim(`(≈ $${cost.toFixed(2)})`),
      );
    }

    if (testResult.status === "failed") {
      this.error("Reason", testResult.reason);
    }

    this.reporterLog.resetGroup();
    this.log.resetGroup();
  }

  onFileEnd(fileResult: FileResult) {
    if (fileResult.status === "failed") {
      this.error("Error processing file", fileResult.reason);
    }
    this.reporterLog.resetGroup();
    this.log.resetGroup();
  }

  onRunEnd() {
    this.summary();
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.COST_PER_1K_INPUT_TOKENS;
    const outputCost = (outputTokens / 1000) * this.COST_PER_1K_OUTPUT_TOKENS;
    return Math.round((inputCost + outputCost) * 1000) / 1000;
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
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;
    const aiCost = this.calculateCost(
      this.totalInputTokens,
      this.totalOutputTokens,
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
}

let reporterLogInstance: Log | null = null;

export function getReporterLog(): Log {
  if (reporterLogInstance) {
    return reporterLogInstance;
  }
  reporterLogInstance = new Log({
    level: "info",
    format: "reporter",
  });
  return reporterLogInstance;
}
