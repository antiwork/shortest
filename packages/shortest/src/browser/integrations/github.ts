import dotenv from "dotenv";
import { authenticator } from "otplib";
import { ENV_LOCAL_FILENAME } from "@/constants";
import { BrowserToolInterface } from "@/types/browser";
import { ConfigError, ShortestError } from "@/utils/errors";

export class GitHubTool {
  private totpSecret: string;
  private readonly selectors = {
    loginForm: "#login form",
    usernameInput: "#login_field",
    passwordInput: "#password",
    submitButton: '[type="submit"]',
    useAuthenticatorButton: 'button:has-text("Use authenticator")',
    useAuthenticatorLink: '[data-test-selector="totp-app-link"]',
    otpInput: "#app_totp",
    errorMessage: ".flash-error",
  };

  constructor(secret?: string) {
    dotenv.config({ path: [".env", ENV_LOCAL_FILENAME] });

    this.totpSecret = secret || process.env.GITHUB_TOTP_SECRET || "";

    if (!this.totpSecret) {
      throw new ConfigError(
        "invalid-config",
        `GITHUB_TOTP_SECRET is required in ${ENV_LOCAL_FILENAME} file or via --secret option`,
      );
    }
  }

  generateTOTPCode(): { code: string; timeRemaining: number } {
    this.validateSecret();
    try {
      const code = authenticator.generate(this.totpSecret);
      const timeRemaining = authenticator.timeRemaining();
      return { code, timeRemaining };
    } catch (error) {
      throw new ShortestError(`Failed to generate TOTP code: ${error}`);
    }
  }

  async GithubLogin(
    browserTool: BrowserToolInterface,
    credentials: { username: string; password: string },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Wait for login form
      await browserTool.waitForSelector(this.selectors.loginForm, {
        timeout: 10000,
      });

      // Fill credentials
      await browserTool.fill(
        this.selectors.usernameInput,
        credentials.username,
      );
      await browserTool.fill(
        this.selectors.passwordInput,
        credentials.password,
      );

      // Submit form
      await browserTool.click(this.selectors.submitButton);

      try {
        await browserTool.waitForSelector(
          this.selectors.useAuthenticatorButton,
          { timeout: 5000 },
        );
        await browserTool.click(this.selectors.useAuthenticatorButton);
      } catch {
        // If button not found, try the link
        await browserTool.waitForSelector(this.selectors.useAuthenticatorLink, {
          timeout: 5000,
        });
        await browserTool.click(this.selectors.useAuthenticatorLink);
      }

      // Wait for OTP input to be visible
      await browserTool.waitForSelector(this.selectors.otpInput, {
        timeout: 1000,
      });

      // Generate and enter TOTP code
      const { code } = this.generateTOTPCode();
      await browserTool.fill(this.selectors.otpInput, code);

      // Start navigation promise before pressing Enter
      const navigationPromise = browserTool.waitForNavigation({
        timeout: 3000,
      });

      // Press Enter and wait for navigation
      await browserTool.press(this.selectors.otpInput, "Enter");
      await navigationPromise;

      const isLoggedIn =
        (await browserTool.findElement(this.selectors.loginForm)) === null;

      return {
        success: isLoggedIn,
        error: isLoggedIn ? undefined : "Failed to verify login success",
      };
    } catch (error) {
      // Check if we're actually logged in despite the error
      try {
        const currentUrl = await browserTool.getPage().url();
        if (!currentUrl.includes("github.com")) {
          return {
            success: true,
          };
        }
      } catch {
        // Ignore URL check errors
      }

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during GitHub login",
      };
    }
  }

  private validateSecret() {
    if (!this.totpSecret) {
      throw new ConfigError(
        "invalid-config",
        `GITHUB_TOTP_SECRET is required in ${ENV_LOCAL_FILENAME} file or via --secret option`,
      );
    }
  }
}
