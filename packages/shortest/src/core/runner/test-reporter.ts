import { AssertionError } from "assert";
import pc from "picocolors";
import { getLogger, Log } from "../../log/index";
import { TestFunction } from "../../types/test";

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
  private legacyOutputEnabled: boolean;
  private log: Log;

  constructor(legacyOutputEnabled: boolean) {
    this.legacyOutputEnabled = legacyOutputEnabled;
    this.log = getLogger();
  }

  initializeTest(test: TestFunction, legacyOutputEnabled: boolean) {
    const testName = test.name || "Unnamed Test";
    this.currentTest = {
      name: testName,
      status: "pending",
    };
    const testKey = `${this.currentFile}:${testName}`;
    this.testResults[testKey] = this.currentTest;
    this.legacyOutputEnabled = legacyOutputEnabled;
  }

  startFile(file: string) {
    this.currentFile = file;
    this.log.info("📄 Starting file", { file: this.currentFile });
    if (this.legacyOutputEnabled) {
      console.log("📄", pc.blue(pc.bold(this.currentFile)));
    }
  }

  startTest(test: TestFunction) {
    this.log.info("Starting test", { test: test.name });
    if (this.legacyOutputEnabled) {
      console.log(this.getStatusIcon("running"), test.name);
    }
  }

  endTest(
    status: "passed" | "failed",
    error?: Error,
    tokenUsage?: TokenMetrics,
  ) {
    if (!this.currentTest) return;

    this.currentTest.status = status;
    this.currentTest.error = error;
    this.currentTest.tokenUsage = tokenUsage;

    this.log.info("Test ended", {
      test: this.currentTest.name,
      status,
      error,
      tokenUsage,
    });
    this.log.info(`${this.getStatusIcon(status)} ${this.currentTest.name}`, {
      status,
    });
    if (error) {
      this.log.error(error.message, {
        error,
      });
    }
    if (tokenUsage) {
      this.log.info("Token usage", {
        input: tokenUsage.input,
        output: tokenUsage.output,
        costAmount: this.calculateCost(tokenUsage.input, tokenUsage.output),
        costCurrency: "USD",
      });
    }
    if (this.legacyOutputEnabled) {
      console.log(
        this.getStatusIcon(status),
        status === "passed"
          ? pc.green(this.currentTest.name)
          : pc.red(this.currentTest.name),
      );

      if (error) {
        console.error(pc.red(error.message));
      }

      if (tokenUsage) {
        console.log(
          pc.dim(
            `  Token usage - Input: ${tokenUsage.input}, Output: ${
              tokenUsage.output
            }, Cost: $${this.calculateCost(
              tokenUsage.input,
              tokenUsage.output,
            )}`,
          ),
        );
      }
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.COST_PER_1K_INPUT_TOKENS;
    const outputCost = (outputTokens / 1000) * this.COST_PER_1K_OUTPUT_TOKENS;
    return Math.round((inputCost + outputCost) * 1000) / 1000;
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
    const { totalInputTokens, totalOutputTokens, totalCost } =
      this.calculateTotalTokenUsage();

    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(
      (test) => test.status === "passed",
    ).length;
    const failedTests = totalTests - passedTests;

    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    const summaryLog = this.log
      .group("Test summary")
      .info("Total tests", { count: totalTests })
      .info("Passed tests", { count: passedTests })
      .info("Failed tests", { count: failedTests })
      .info("Duration", { seconds: duration });

    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      summaryLog.info("Token usage", {
        input: totalInputTokens,
        output: totalOutputTokens,
        costAmount: totalCost.toFixed(4),
        costCurrency: "USD",
      });
    }

    if (failedTests > 0) {
      this.log.info("Failed tests");
      Object.entries(this.testResults)
        .filter(([, test]) => test.status === "failed")
        .forEach(([key, test]) => {
          this.log.info(pc.red(`  ${key}`));
          if (test.error) {
            this.log.error(test.error.message);
          }
        });
    }
    if (this.legacyOutputEnabled) {
      console.log("\nTest Summary:");
      console.log(
        pc.dim(
          `  Duration: ${duration}s, Total tests: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`,
        ),
      );

      if (totalInputTokens > 0 || totalOutputTokens > 0) {
        console.log(
          pc.dim(
            `  Total token usage - Input: ${totalInputTokens}, Output: ${totalOutputTokens}, Cost: $${totalCost.toFixed(
              4,
            )}`,
          ),
        );
      }

      if (failedTests > 0) {
        console.log("\nFailed Tests:");
        Object.entries(this.testResults)
          .filter(([, test]) => test.status === "failed")
          .forEach(([key, test]) => {
            console.log(pc.red(`  ${key}`));
            if (test.error) {
              console.log(pc.dim(`    ${test.error.message}`));
            }
          });
      }
    }
  }

  allTestsPassed(): boolean {
    return !Object.values(this.testResults).some(
      (test) => test.status === "failed",
    );
  }

  reportStatus(message: string) {
    this.log.info("Status", { message });
    if (this.legacyOutputEnabled) {
      console.log(pc.dim(message));
    }
  }

  error(context: string, message: string) {
    this.log.error(message, { context });
    if (this.legacyOutputEnabled) {
      console.error(pc.red(`${context}: ${message}`));
    }
  }

  reportError(context: string, message: string) {
    this.log.error(message, { context });
    if (this.legacyOutputEnabled) {
      console.error(pc.red(`${context}: ${message}`));
    }
  }

  reportAssertion(
    step: string,
    status: "passed" | "failed",
    error?: AssertionError,
  ): void {
    this.log.info("Assertion", { step, status, error });
    if (this.legacyOutputEnabled) {
      if (status === "passed") {
        console.log(pc.green(`✓ ${step}`));
      } else {
        console.log(pc.red(`✗ ${step}`));
        if (error) {
          console.log(pc.dim(error.message));
        }
      }
    }
  }
}
