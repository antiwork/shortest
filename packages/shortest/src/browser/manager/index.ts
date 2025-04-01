import { execSync } from "child_process";
import { URL } from "url";
import pc from "picocolors";
import { Browser, BrowserContext, chromium } from "playwright";
import { getLogger, Log } from "@/log/index";
import { ShortestConfig } from "@/types/config";
import { ShortestError } from "@/utils/errors";
import { getInstallationCommand } from "@/utils/platform";

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: ShortestConfig;
  private log: Log;

  constructor(config: ShortestConfig) {
    this.config = config;
    this.log = getLogger();
  }

  async launch(): Promise<BrowserContext> {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless ?? false,
      });
    } catch (error) {
      // Check if error is about missing browser
      if (
        error instanceof Error &&
        error.message.includes("Executable doesn't exist")
      ) {
        this.log.info("Installing Playwright browser...");

        const installationCommand = await getInstallationCommand();

        execSync(installationCommand, { stdio: "inherit" });
        this.log.info(pc.green("✓"), "Playwright browser installed");

        this.browser = await chromium.launch({
          headless: this.config.headless ?? false,
        });
      } else {
        // If it's some other error, rethrow
        throw error;
      }
    }

    const contextOptions = {
      viewport: { width: 1920, height: 1080 },
      baseURL: this.config.baseUrl,
      ...this.config.browser?.contextOptions,
    };
    this.log.trace("Initializing browser context", { options: contextOptions });
    this.context = await this.browser.newContext(contextOptions);

    const page = await this.context.newPage();
    await page.goto(this.normalizeUrl(this.config.baseUrl));
    await page.waitForLoadState("networkidle");

    return this.context;
  }

  async clearContext(): Promise<BrowserContext> {
    if (!this.context) {
      throw new ShortestError("No context available");
    }

    // Clear all browser state
    await Promise.all([
      this.context.clearCookies(),
      // Clear storage
      this.context.pages().map((page) =>
        page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
          indexedDB.deleteDatabase("shortest");
        }),
      ),
      // Clear permissions
      this.context.clearPermissions(),
    ]);

    // Navigate all pages to blank
    await Promise.all(
      this.context.pages().map((page) => page.goto("about:blank")),
    );

    // Close all pages except first
    const pages = this.context.pages();
    if (pages.length > 1) {
      await Promise.all(pages.slice(1).map((page) => page.close()));
    }

    // Navigate first page to baseUrl
    const baseUrl = this.config.baseUrl;
    await pages[0].goto(baseUrl);
    await pages[0].waitForLoadState("networkidle");

    return this.context;
  }

  recreateContext(): Promise<BrowserContext> {
    return this.clearContext();
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  private normalizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }
}
