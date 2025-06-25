import pc from "picocolors";
import { createBrowserTool } from "./test-helpers";
import { GitHubTool } from "@/browser/integrations/github";
import { BrowserManager } from "@/browser/manager";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { getConfig, initializeConfig } from "@/index";

export const main = async () => {
  const browserManager = new BrowserManager(getConfig());
  const githubTool = new GitHubTool();

  try {
    await initializeConfig({});
    console.log(pc.cyan("\n🚀 First browser launch..."));
    let context = await browserManager.launch();
    let page = context.pages()[0];

    const testCase = createTestCase({
      name: "GitHub Login Test",
      filePath: "tests/e2e/test-github-login.ts",
    });
    const testRun = TestRun.create(testCase);
    testRun.markRunning();

    let browserTool = createBrowserTool(page, browserManager, testRun);

    console.log(pc.cyan("\n🧹 Clearing initial session..."));
    const result = await browserTool.execute({ action: "clear_session" });
    console.log(pc.yellow("\nBrowser Tool Result:"), result);
    console.log(pc.yellow("\nMetadata:"), result.metadata);

    // Get fresh page reference after clear_session
    context = browserManager.getContext()!;
    page = context.pages()[0];

    // Update browserTool with new page
    browserTool = createBrowserTool(page, browserManager, testRun);

    // Continue with fresh page reference
    await page.waitForSelector('button:has-text("Sign in")', {
      state: "visible",
    });
    await page.click('button:has-text("Sign in")');

    // Wait for GitHub button to be ready
    await page.waitForSelector(".cl-socialButtonsBlockButton__github", {
      state: "visible",
    });
    await page.click(".cl-socialButtonsBlockButton__github");

    console.log(pc.cyan("\n🔐 Starting GitHub login flow..."));
    await githubTool.GithubLogin(browserTool, {
      username: process.env.GITHUB_USERNAME || "",
      password: process.env.GITHUB_PASSWORD || "",
    });

    console.log(pc.cyan("\n🔒 Closing first browser..."));
    await browserManager.close();

    // Launch fresh browser
    console.log(
      pc.cyan("\n🚀 Launching fresh browser to verify clean state..."),
    );
    const newContext = await browserManager.launch();
    const newPage = newContext.pages()[0];

    // Create new browser tool instance
    browserTool = createBrowserTool(page, browserManager, testRun);

    console.log(pc.cyan("\n🔍 Checking login state..."));
    await newPage.goto("http://localhost:3000");
    await newPage.waitForLoadState("networkidle");
    console.log(pc.cyan("\n🧹 Clearing initial session..."));
    await browserTool.execute({ action: "clear_session" });
    await newPage.waitForTimeout(2000);

    console.log(pc.green("\n✅ Clean Session Test Complete"));
  } catch (error) {
    console.error(pc.red("\n❌ Test failed:"), error);
  } finally {
    await browserManager.close();
  }
};

console.log(pc.cyan("🧪 Session Cleanup Test"));
console.log(pc.cyan("===================="));
