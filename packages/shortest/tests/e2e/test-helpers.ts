import * as playwright from "playwright";
import { request } from "playwright";
import { BrowserTool } from "@/browser/core/browser-tool";
import { BrowserManager } from "@/browser/manager";
import { TestRun } from "@/core/runner/test-run";
import { getConfig } from "@/index";

export interface TestContext {
  page: playwright.Page;
  browser: playwright.Browser;
  testRun: TestRun;
  currentStepIndex: number;
  playwright: typeof playwright & {
    request: typeof request & {
      newContext: (options?: {
        extraHTTPHeaders?: Record<string, string>;
      }) => Promise<playwright.APIRequestContext>;
    };
  };
}

export const createBrowserTool = (
  page: playwright.Page,
  browserManager: BrowserManager,
  testRun: TestRun,
  options: { width?: number; height?: number } = {},
): BrowserTool => {
  const { width = 1920, height = 1080 } = options;

  return new BrowserTool(page, browserManager, {
    width,
    height,
    testContext: {
      page,
      browser: browserManager.getBrowser()!,
      testRun,
      currentStepIndex: 0,
      playwright: {
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
      },
    },
  });
};
