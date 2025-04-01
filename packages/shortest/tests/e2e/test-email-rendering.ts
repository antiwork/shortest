import Mailosaur from "mailosaur";
import pc from "picocolors";
import * as playwright from "playwright";
import { chromium, request } from "playwright";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BrowserManager } from "@/browser/manager";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { getConfig, initializeConfig } from "@/index";

export const main = async () => {
  console.log(pc.cyan("\n📧 Testing Email"));

  await initializeConfig({});
  const config = getConfig();

  if (!config.mailosaur?.apiKey || !config.mailosaur?.serverId) {
    throw new Error("Mailosaur config missing");
  }

  // Setup Mailosaur
  const mailosaur = new Mailosaur(config.mailosaur.apiKey);

  try {
    // 1. Send a test email
    console.log("Sending test email...");
    await mailosaur.messages.create(config.mailosaur.serverId, {
      to: "test@example.com",
      subject: "Test Email Rendering",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>This is a test email for rendering validation.</p>
          <a href="https://example.com">Test Link</a>
        </div>
      `,
    });

    // 2. Setup browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const browserManager = new BrowserManager(config);
    const testCase = createTestCase({
      name: "Email Rendering Test",
      filePath: "tests/e2e/test-email-rendering.ts",
    });
    const testRun = TestRun.create(testCase);
    testRun.markRunning();

    const browserTool = new BrowserTool(page, browserManager, {
      width: 1280,
      height: 720,
      testContext: {
        page,
        browser: browserManager.getBrowser()!,
        playwright: {
          ...playwright,
          request: {
            ...request,
            newContext: async (options?: {
              extraHTTPHeaders?: Record<string, string>;
            }) => {
              const requestContext = await request.newContext({
                baseURL: config.baseUrl,
                ...options,
              });
              return requestContext;
            },
          },
        },
        testRun,
      },
    });

    // 3. Test render_email tool
    console.log("Testing email rendering...");
    const result = await browserTool.execute({
      action: "check_email",
    });

    // 4. Validate
    console.log("Validating result...");
    if (!result.metadata?.window_info?.title?.includes("Test Email")) {
      throw new Error("Email content not found");
    }

    console.log(pc.green("✓ Email rendering test passed"));

    // 5. Cleanup
    await browser.close();
  } catch (error) {
    console.error(pc.red("❌ Email test failed:"), error);
    throw error;
  }
};
