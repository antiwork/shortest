import pc from "picocolors";
import * as playwright from "playwright";
import { request } from "playwright";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BrowserManager } from "@/browser/manager";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { getConfig, initializeConfig } from "@/index";

export const main = async () => {
  console.log(pc.cyan("\n🧪 Testing AI Integration"));
  console.log(pc.cyan("======================="));

  const browserManager = new BrowserManager(getConfig());

  try {
    await initializeConfig({});
    console.log("🚀 Launching browser...");
    const context = await browserManager.launch();
    const page = context.pages()[0];

    // Create playwright object with request context
    const playwrightObj = {
      ...playwright,
      request: {
        ...request,
        newContext: async (options?: {
          extraHTTPHeaders?: Record<string, string>;
        }) => {
          const requestContext = await request.newContext({
            baseURL: getConfig().baseUrl,
            ...options,
          });
          return requestContext;
        },
      },
    };

    // Mock test data with callback
    const mockTest = createTestCase({
      name: "Test with callback",
      filePath: "test-ai.ts",
      fn: () => {
        console.log("Callback executed: Main test");
      },
      expectations: [
        {
          description: "action performed",
          fn: () => {
            console.log("Callback executed: Expectation");
          },
        },
      ],
    });

    const testRun = TestRun.create(mockTest);
    testRun.markRunning();

    const browserTool = new BrowserTool(page, browserManager, {
      width: 1920,
      height: 1080,
      testContext: {
        page,
        browser: browserManager.getBrowser()!,
        playwright: playwrightObj,
        testRun,
        currentStepIndex: 0,
      },
    });

    // Test first callback
    console.log("\n🔍 Testing first callback:");
    const result = await browserTool.execute({
      action: "run_callback",
    });
    console.log("Result:", result);

    // Update test context for expectation callback
    browserTool.updateTestContext({
      page,
      browser: browserManager.getBrowser()!,
      playwright: playwrightObj,
      testRun,
      currentStepIndex: 1,
    });

    // Test expectation callback
    console.log("\n🔍 Testing expectation callback:");
    const result2 = await browserTool.execute({
      action: "run_callback",
    });
    console.log("Result:", result2);
  } catch (error) {
    console.error(pc.red("❌ Test failed:"), error);
  } finally {
    console.log("\n🧹 Cleaning up...");
    await browserManager.close();
  }
};

console.log("🤖 AI Integration Test");
console.log("=====================");
