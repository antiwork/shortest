import pc from "picocolors";
import { AssertionError, TestFunction } from "../../types";

export type TestStatus = "pending" | "running" | "passed" | "failed";

interface TokenMetrics {
  input: number;
  output: number;
}

interface TestResult {
  name: string;
  status: TestStatus;
  error?: Error;
  tokenUsage?: TokenMetrics;
}

export class TestReporter {
  private currentFile: string = "";
  private testResults: Record<string, TestResult> = {};
  private startTime: number = Date.now();
  private currentTest: TestResult | null = null;

  // token pricing (Claude 3.5 Sonnet)
  private readonly COST_PER_1K_INPUT_TOKENS = 0.003;
  private readonly COST_PER_1K_OUTPUT_TOKENS = 0.015;

  initializeTest(test: TestFunction) {
    const testKey = test.name || "Unnamed Test";
    this.currentTest = {
      name: testKey,
      status: "pending",
    };
    this.testResults[testKey] = this.currentTest;
  }

  startFile(file: string) {
    this.currentFile = file;
    console.log("📄", pc.blue(pc.bold(this.currentFile)));
  }

  startTest(test: TestFunction) {
    console.log(this.getStatusIcon("running"), test.name);
  }

  endTest(
    status: "passed" | "failed",
    error?: Error,
    tokenUsage?: TokenMetrics,
  ) {
    if (!this.currentTest) {
      throw new Error("Current test not initialized");
    }

    this.testResults[this.currentTest.name].status = status;
    this.testResults[this.currentTest.name].error = error;
    this.testResults[this.currentTest.name].tokenUsage = tokenUsage;

    const symbol = status === "passed" ? "✓" : "✗";
    const color = status === "passed" ? pc.green : pc.red;

    console.log(`\n  ${color(`${symbol} ${status}`)}`);

    if (tokenUsage) {
      const totalTokens = tokenUsage.input + tokenUsage.output;
      const cost = this.calculateCost(tokenUsage.input, tokenUsage.output);
      console.log(
        pc.dim(
          `    ↳ ${totalTokens.toLocaleString()} tokens ` +
            `(≈ $${cost.toFixed(2)})`,
        ),
      );
    }

    if (error) {
      this.reportError("Test Execution", error.message);
    }

    this.currentTest = null;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.COST_PER_1K_INPUT_TOKENS;
    const outputCost = (outputTokens / 1000) * this.COST_PER_1K_OUTPUT_TOKENS;
    return Number((inputCost + outputCost).toFixed(3));
  }

  private calculateTotalTokenUsage(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  } {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    Object.values(this.testResults).forEach((result) => {
      if (result.tokenUsage) {
        totalInputTokens += result.tokenUsage.input;
        totalOutputTokens += result.tokenUsage.output;
      }
    });

    const totalCost = this.calculateCost(totalInputTokens, totalOutputTokens);

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCost,
    };
  }

  private getStatusIcon(status: TestStatus): string {
    switch (status) {
      case "pending":
        return pc.yellow("○");
      case "running":
        return pc.blue("●");
      case "passed":
        return pc.green("✓");
      case "failed":
        return pc.red("✗");
    }
  }

  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const totalTests = Object.keys(this.testResults).length;
    const failedTests = Object.values(this.testResults).filter(
      (t) => t.status === "failed",
    ).length;
    const passedTests = totalTests - failedTests;

    const { totalInputTokens, totalOutputTokens, totalCost } =
      this.calculateTotalTokenUsage();
    const totalTokens = totalInputTokens + totalOutputTokens;

    console.log(pc.dim("⎯".repeat(50)), "\n");

    const LABEL_WIDTH = 15;
    console.log(
      pc.bold(" Tests".padEnd(LABEL_WIDTH)),
      failedTests
        ? `${pc.red(`${failedTests} failed`)} | ${pc.green(`${passedTests} passed`)}`
        : pc.green(`${passedTests} passed`),
      pc.dim(`(${totalTests})`),
    );

    console.log(
      pc.bold(" Duration".padEnd(LABEL_WIDTH)),
      pc.dim(`${duration}s`),
    );
    console.log(
      pc.bold(" Started at".padEnd(LABEL_WIDTH)),
      pc.dim(new Date(this.startTime).toLocaleTimeString()),
    );
    console.log(
      pc.bold(" Tokens".padEnd(LABEL_WIDTH)),
      pc.dim(
        `${totalTokens.toLocaleString()} tokens ` +
          `(≈ $${totalCost.toFixed(2)})`,
      ),
    );
    console.log("\n", pc.dim("⎯".repeat(50)));
  }

  allTestsPassed(): boolean {
    return !Object.values(this.testResults).some(
      (test) => test.status === "failed",
    );
  }

  reportStatus(message: string) {
    console.log(pc.blue(`\n${message}`));
  }

  error(context: string, message: string) {
    console.error(pc.red(`\n${context} Error: ${message}`));
  }

  reportError(context: string, message: string) {
    console.error(pc.red(`\n${context} Error: ${message}`));
  }

  reportAssertion(
    step: string,
    status: "passed" | "failed",
    error?: AssertionError,
  ): void {
    const icon = status === "passed" ? "✓" : "✗";
    const color = status === "passed" ? "green" : "red";

    console.log(pc[color](`${icon} ${step}`));

    if (error && status === "failed") {
      console.log(pc.red(`  Expected: ${error.matcherResult?.expected}`));
      console.log(pc.red(`  Received: ${error.matcherResult?.actual}`));
      console.log(pc.red(`  Message: ${error.message}`));
    }
  }
}
