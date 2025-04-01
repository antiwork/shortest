// Add window interface extension
declare global {
  interface Window {
    cursorPosition: { x: number; y: number };
    lastPosition: { x: number; y: number };
    showClick: () => void;
  }
}

import * as fs from "fs/promises";
import { join } from "path";
import { Page } from "playwright";
import * as actions from "@/browser/actions";
import { BaseBrowserTool } from "@/browser/core";
import { GitHubTool } from "@/browser/integrations/github";
import { MailosaurTool } from "@/browser/integrations/mailosaur";
import { BrowserManager } from "@/browser/manager";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { getConfig, initializeConfig } from "@/index";
import { getLogger, Log } from "@/log/index";
import { TestContext, BrowserToolConfig, ShortestConfig } from "@/types";
import {
  ActionInput,
  ToolResult,
  BetaToolType,
  InternalActionEnum,
} from "@/types/browser";
import { getErrorDetails, ToolError, TestError } from "@/utils/errors";

export class BrowserTool extends BaseBrowserTool {
  protected readonly toolType: BetaToolType = "computer_20241022";
  protected readonly toolName: string = "computer";
  private page: Page;
  private browserManager: BrowserManager;
  private cursorVisible: boolean = true;
  private lastMousePosition: [number, number] = [0, 0];
  private githubTool?: GitHubTool;
  private viewport: { width: number; height: number };
  private testContext: TestContext;
  private readonly MAX_SCREENSHOTS = 10;
  private readonly MAX_AGE_HOURS = 5;
  private mailosaurTool?: MailosaurTool;
  private config!: ShortestConfig;
  private log: Log;
  constructor(
    page: Page,
    browserManager: BrowserManager,
    config: BrowserToolConfig,
  ) {
    super(config);
    this.page = page;
    this.browserManager = browserManager;
    this.viewport = { width: config.width, height: config.height };
    this.testContext = config.testContext;
    this.log = getLogger();
    this.page.context().on("page", async (newPage) => {
      this.log.trace("Update active page reference to a newly opened tab");
      await newPage.waitForLoadState("domcontentloaded").catch(() => {});
      this.page = newPage;
    });

    this.initialize();
  }

  public async click(selector: string): Promise<void> {
    this.log.debug("Clicking element", { selector });
    await this.page.click(selector);
  }

  async execute(input: ActionInput): Promise<ToolResult> {
    try {
      this.log.setGroup(`🛠️ ${input.action}`);
      let output = "";
      let metadata = {};

      switch (input.action) {
        case InternalActionEnum.LEFT_CLICK:
        case InternalActionEnum.RIGHT_CLICK:
        case InternalActionEnum.MIDDLE_CLICK:
        case InternalActionEnum.DOUBLE_CLICK:
        case InternalActionEnum.TRIPLE_CLICK: {
          const clickCoords =
            input.coordinate || input.coordinates || this.lastMousePosition;
          const x = clickCoords[0];
          const y = clickCoords[1];
          const button = () => {
            switch (input.action) {
              case InternalActionEnum.LEFT_CLICK:
              case InternalActionEnum.DOUBLE_CLICK:
              case InternalActionEnum.TRIPLE_CLICK:
                return "left";
              case InternalActionEnum.RIGHT_CLICK:
                return "right";
              case InternalActionEnum.MIDDLE_CLICK:
                return "middle";
              default:
                throw new ToolError(
                  `Unsupported click action: ${input.action}`,
                );
            }
          };
          const clickCount = () => {
            switch (input.action) {
              case InternalActionEnum.DOUBLE_CLICK:
                return 2;
              case InternalActionEnum.TRIPLE_CLICK:
                return 3;
              default:
                return 1;
            }
          };
          this.log.debug("Clicking at coordinates", {
            x,
            y,
            button: button(),
            clickCount: clickCount(),
          });
          await actions.click(this.page, x, y, {
            button: button(),
            clickCount: clickCount(),
          });
          output = `${input.action} at (${clickCoords[0]}, ${clickCoords[1]})`;

          // Get initial metadata before potential navigation
          metadata = await this.getMetadata();

          // Wait briefly for navigation to start
          await this.page.waitForTimeout(100);

          // If navigation started, get updated metadata
          if (
            await this.page
              .evaluate(() => document.readyState !== "complete")
              .catch(() => true)
          ) {
            try {
              await this.page.waitForLoadState("domcontentloaded", {
                timeout: 5000,
              });
              metadata = await this.getMetadata();
            } catch {
              // Keep the initial metadata if navigation timeout
            }
          }
          break;
        }

        case InternalActionEnum.MOUSE_MOVE:
          const coords = input.coordinates || (input as any).coordinate;
          if (!coords) {
            throw new ToolError("Coordinates required for mouse_move");
          }
          await actions.mouseMove(this.page, coords[0], coords[1]);
          this.lastMousePosition = [coords[0], coords[1]];
          output = `Mouse moved to (${coords[0]}, ${coords[1]})`;
          break;

        case InternalActionEnum.LEFT_CLICK_DRAG:
          if (!input.coordinates) {
            throw new ToolError("Coordinates required for left_click_drag");
          }
          await actions.dragMouse(
            this.page,
            input.coordinates[0],
            input.coordinates[1],
          );
          output = `Dragged mouse to (${input.coordinates[0]}, ${input.coordinates[1]})`;
          break;

        case InternalActionEnum.LEFT_MOUSE_DOWN:
          await this.page.mouse.down();
          output = "Pressed left mouse button";
          break;

        case InternalActionEnum.LEFT_MOUSE_UP:
          await this.page.mouse.up();
          output = "Released left mouse button";
          break;

        case InternalActionEnum.CURSOR_POSITION:
          const position = await actions.getCursorPosition(this.page);
          output = `Cursor position: (${position[0]}, ${position[1]})`;
          break;

        case InternalActionEnum.SCREENSHOT:
          return await this.takeScreenshotWithMetadata();

        case InternalActionEnum.TYPE:
          if (!input.text) {
            throw new ToolError("Text required for type action");
          }
          await this.page.waitForTimeout(100);
          await this.page.keyboard.type(input.text);
          await this.page.waitForTimeout(100);
          output = `Typed: ${input.text}`;
          break;

        case InternalActionEnum.KEY: {
          if (!input.text) {
            throw new ToolError("Key required for key action");
          }

          await this.page.waitForTimeout(100);

          const keyText = input.text.toLowerCase();
          const keys = Array.isArray(actions.keyboardShortcuts[keyText])
            ? actions.keyboardShortcuts[keyText]
            : [actions.keyboardShortcuts[keyText] || input.text];

          if (Array.isArray(keys)) {
            for (const key of keys) {
              await this.page.keyboard.down(key);
            }
            for (const key of [...keys].reverse()) {
              await this.page.keyboard.up(key);
            }
          } else {
            await this.page.keyboard.press(keys);
          }

          await this.page.waitForTimeout(100);
          output = `Pressed key: ${input.text}`;
          break;
        }

        case InternalActionEnum.HOLD_KEY: {
          if (!input.text) {
            throw new ToolError("Key required for hold_key action");
          }

          if (!input.duration) {
            throw new ToolError("Duration required for hold_key action");
          }

          const seconds = input.duration;
          const delay = seconds / 1000;

          const keyText = input.text.toLowerCase();
          const keys = Array.isArray(actions.keyboardShortcuts[keyText])
            ? actions.keyboardShortcuts[keyText]
            : [actions.keyboardShortcuts[keyText] || input.text];

          const parsedKeys = keys.join("+");
          await this.page.keyboard.press(parsedKeys, { delay });

          output = `Held key: ${parsedKeys} for ${seconds} second${seconds !== 1 ? "s" : ""}`;
          break;
        }

        case InternalActionEnum.GITHUB_LOGIN: {
          if (!this.githubTool) {
            this.githubTool = new GitHubTool();
          }
          const loginResult = await this.githubTool.GithubLogin(this, {
            username: input.username as string,
            password: input.password as string,
          });

          output = loginResult.success
            ? "GitHub login was successfully completed"
            : `GitHub login failed: ${loginResult.error}`;
          break;
        }

        case InternalActionEnum.CLEAR_SESSION:
          const newContext = await this.browserManager.recreateContext();
          this.page = newContext.pages()[0] || (await newContext.newPage());
          await this.page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });

          return {
            output: "Successfully cleared browser data and created new context",
            metadata: {},
          };

        case InternalActionEnum.RUN_CALLBACK: {
          const testContext = this.testContext;
          const testCase = testContext.testRun.testCase;

          const currentStepIndex = testContext.currentStepIndex ?? 0;

          try {
            if (currentStepIndex === 0 && testCase.fn) {
              await testCase.fn(testContext);
              testContext.currentStepIndex = 1;
              return { output: "Test function executed successfully" };
            }
            // Handle expectations
            const expectationIndex = currentStepIndex - 1;
            const expectation = testCase.expectations?.[expectationIndex];

            if (expectation?.fn) {
              await expectation.fn(this.testContext);
              testContext.currentStepIndex = currentStepIndex + 1;
              return {
                output: `Callback function for "${expectation.description}" passed successfully`,
              };
            }
            return {
              output: `Skipping callback execution: No callback function defined for expectation "${expectation?.description}"`,
            };
          } catch (error) {
            // Check if it's an assertion error from jest/expect
            if (error && (error as any).matcherResult) {
              const assertionError = error as any;
              throw new TestError("assertion-failed", assertionError.message, {
                actual: assertionError.matcherResult.actual,
                expected: assertionError.matcherResult.expected,
              });
            }
            throw new TestError(
              "callback-execution-failed",
              error instanceof Error ? error.message : String(error),
            );
          }
        }

        case InternalActionEnum.NAVIGATE: {
          if (!input.url) {
            throw new ToolError("URL required for navigation");
          }

          // Create new tab
          this.log.trace("Creating new tab");
          const newPage = await this.page.context().newPage();

          try {
            const navigationTimeout = 30000;

            this.log.trace("Navigating to", { url: input.url });
            await newPage.goto(input.url, {
              timeout: navigationTimeout,
              waitUntil: "domcontentloaded",
            });

            await newPage
              .waitForLoadState("load", {
                timeout: 5000,
              })
              .catch((error) => {
                this.log.debug("⚠️", "Load timeout, continuing anyway", {
                  error,
                });
              });

            // Switch focus
            this.page = newPage;

            output = `Navigated to ${input.url}`;
            metadata = {
              window_info: {
                url: input.url,
                title: await newPage.title(),
                size: this.page.viewportSize() || {
                  width: this.width,
                  height: this.height,
                },
              },
            };
            this.log.trace("Navigation completed", metadata);

            break;
          } catch (error) {
            await newPage.close();
            throw new ToolError(`Navigation failed: ${error}`);
          }
        }

        case InternalActionEnum.WAIT:
          if (!input.duration) {
            throw new ToolError("Duration required for wait action");
          }
          const seconds = input.duration;
          await this.page.waitForTimeout(seconds * 1000);
          output = `Waited for ${seconds} second${seconds !== 1 ? "s" : ""}`;
          break;

        case InternalActionEnum.SCROLL:
          if (
            !input.coordinate ||
            !input.scroll_amount ||
            !input.scroll_direction
          ) {
            throw new ToolError("Missing args for scroll action");
          }
          await this.page.mouse.move(input.coordinate[0], input.coordinate[1]);
          const deltaX =
            (input.scroll_direction === "up"
              ? -input.scroll_amount
              : input.scroll_amount) || 0;
          const deltaY =
            (input.scroll_direction === "left"
              ? -input.scroll_amount
              : input.scroll_amount) || 0;
          await this.page.mouse.wheel(deltaX, deltaY);
          output = `Scrolled ${input.scroll_amount} clicks ${input.scroll_direction}`;
          break;

        case InternalActionEnum.SLEEP: {
          const defaultDuration = 1000;
          const maxDuration = 60000;
          let duration = input.duration ?? defaultDuration;

          // Enforce maximum duration
          if (duration > maxDuration) {
            this.log.debug(
              `Requested sleep duration ${duration}ms exceeds maximum of ${maxDuration}ms. Using maximum.`,
            );
            duration = maxDuration;
          }

          const seconds = Math.round(duration / 1000);
          this.log.debug("⏳", "Waiting ...", { seconds });

          await this.page.waitForTimeout(duration);
          output = `Finished waiting for ${seconds} second${seconds !== 1 ? "s" : ""}`;
          break;
        }

        case InternalActionEnum.CHECK_EMAIL: {
          if (!this.mailosaurTool) {
            const mailosaurAPIKey =
              this.config.mailosaur?.apiKey || process.env.MAILOSAUR_API_KEY;
            const mailosaurServerId =
              this.config.mailosaur?.serverId ||
              process.env.MAILOSAUR_SERVER_ID;

            if (!mailosaurAPIKey) {
              return {
                output: "Mailosaur API key is required",
                error: "MAILOSAUR_CONFIG_ERROR",
              };
            }

            if (!mailosaurServerId) {
              return {
                output: "Mailosaur server ID is required",
                error: "MAILOSAUR_CONFIG_ERROR",
              };
            }

            if (!input.email) {
              return {
                output: "Mailosaur email address is required",
                error: "MAILOSAUR_CONFIG_ERROR",
              };
            }

            this.mailosaurTool = new MailosaurTool({
              apiKey: mailosaurAPIKey,
              serverId: mailosaurServerId,
              emailAddress: input.email,
            });
          }

          const newPage = await this.page.context().newPage();

          try {
            const email = await this.mailosaurTool.getLatestEmail();

            // Render email in new tab
            await newPage.setContent(email.html, {
              waitUntil: "domcontentloaded",
            });

            await newPage
              .waitForLoadState("load", {
                timeout: 5000,
              })
              .catch((error) => {
                this.log.debug("⚠️", "Load timeout, continuing anyway", {
                  error,
                });
              });

            // Switch focus
            this.page = newPage;

            output = `Email received successfully. Navigated to new tab to display email: ${email.subject}`;
            metadata = {
              window_info: {
                title: email.subject,
                content: email.html,
                size: this.page.viewportSize() || {
                  width: this.width,
                  height: this.height,
                },
              },
            };

            break;
          } catch (error: unknown) {
            await newPage.close();
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("Email content missing")) {
              return {
                output: `Email was found but content is missing. This might be due to malformed email. Moving to next test.`,
                error: "EMAIL_CONTENT_MISSING",
              };
            }

            if (errorMessage.includes("Mailosaur email address is required")) {
              return {
                output: `Email address is required but was not provided.`,
                error: "EMAIL_ADDRESS_MISSING",
              };
            }

            if (errorMessage.includes("No matching messages found")) {
              return {
                output: `No email found for ${input.email}. The email might not have been sent yet or is older than 1 hour. Moving to next test.`,
                error: "EMAIL_NOT_FOUND",
              };
            }

            // Generic error case
            return {
              output: `Failed to fetch or render email: ${errorMessage}. Moving to next test.`,
              error: "EMAIL_OPERATION_FAILED",
            };
          }
        }

        default:
          throw new ToolError(`Unknown action: ${input.action}`);
      }

      // Get and log metadata
      try {
        await this.page.waitForTimeout(200);
        metadata = await this.getMetadata();
      } catch (metadataError) {
        this.log.debug("Failed to get metadata:", { metadataError });
        metadata = {};
      }

      return {
        output,
        metadata,
      };
    } catch (error) {
      this.log.error("Browser action failed", getErrorDetails(error));

      if (error instanceof TestError && error.type === "assertion-failed") {
        return {
          output: `Assertion failed: ${error.message}${
            error.actual !== undefined
              ? `\nExpected: ${error.expected}\nReceived: ${error.actual}`
              : ""
          }`,
        };
      }
      if (
        error instanceof TestError &&
        error.type === "callback-execution-failed"
      ) {
        return {
          output: `Callback execution failed: ${error.message}`,
        };
      }
      throw new ToolError(`Action failed: ${error}`);
    } finally {
      this.log.resetGroup();
    }
  }

  /**
   * Converts browser tool execution results to standardized content format.
   * Handles image data and text output formatting.
   *
   * @param {ToolResult} result - Raw tool execution result
   * @returns {Array<{type: string, data?: string, text?: string, mimeType?: string}>} Formatted content
   *
   * @private
   */
  public resultToToolResultContent(result: ToolResult) {
    return result.base64_image
      ? [
          {
            type: "image" as const,
            data: result.base64_image,
            mimeType: "image/jpeg",
          },
        ]
      : [
          {
            type: "text" as const,
            text: result.output!,
          },
        ];
  }

  toToolParameters() {
    return {
      type: this.toolType,
      name: this.toolName,
      display_width_px: this.width,
      display_height_px: this.height,
      display_number: this.displayNum,
    };
  }

  // Selector-based methods
  public async waitForSelector(
    selector: string,
    options?: { timeout: number },
  ): Promise<void> {
    this.log.debug("Waiting for selector", { selector });
    await this.page.waitForSelector(selector, options);
  }

  public async fill(selector: string, value: string): Promise<void> {
    this.log.debug("Filling element", { selector, value });
    await this.page.fill(selector, value);
  }

  public async press(selector: string, key: string): Promise<void> {
    this.log.debug("Pressing key on element", { key, element: selector });
    await this.page.press(selector, key);
  }

  public findElement(selector: string) {
    this.log.debug("Finding element", { selector });
    return this.page.$(selector);
  }

  getPage(): Page {
    return this.page;
  }

  public async waitForNavigation(options?: { timeout: number }): Promise<void> {
    this.log.debug("Waiting for navigation");
    await this.page.waitForLoadState("load", { timeout: options?.timeout });
  }

  updateTestContext(newContext: TestContext) {
    this.testContext = newContext;
  }

  async showCursor(): Promise<void> {
    this.cursorVisible = true;
    await this.page.evaluate(() => {
      const cursor = document.getElementById("ai-cursor");
      const trail = document.getElementById("ai-cursor-trail");
      if (cursor) cursor.style.display = "block";
      if (trail) trail.style.display = "block";
    });
  }

  async hideCursor(): Promise<void> {
    this.cursorVisible = false;
    await this.page.evaluate(() => {
      const cursor = document.getElementById("ai-cursor");
      const trail = document.getElementById("ai-cursor-trail");
      if (cursor) cursor.style.display = "none";
      if (trail) trail.style.display = "none";
    });
  }

  /**
   * Retrieves normalized component string by X and Y coordinates
   * This is primarily used to determine change in UI
   * Playwright currently does not support such functionality
   * @see https://github.com/microsoft/playwright/issues/13273
   */
  async getNormalizedComponentStringByCoords(x: number, y: number) {
    return await this.getPage().evaluate(
      ({ x, y, allowedAttr }) => {
        const elem = document.elementFromPoint(x, y);
        if (elem) {
          // todo: test func below
          const clone = elem.cloneNode(true) as HTMLElement;

          /**
           * Gets deepest nested child node
           * If several nodes are on the same depth, the first node would be returned
           */
          const getDeepestChildNode = (element: Element): HTMLElement => {
            let deepestChild = element.cloneNode(true) as HTMLElement;
            let maxDepth = 0;

            const traverse = (node: any, depth: number) => {
              if (depth > maxDepth) {
                maxDepth = depth;
                deepestChild = node;
              }

              Array.from(node.children).forEach((child) => {
                traverse(child, depth + 1);
              });
            };

            traverse(deepestChild, 0);
            return deepestChild;
          };

          const deepestNode = getDeepestChildNode(clone);

          // get several parents if present
          const node = deepestNode.parentElement
            ? deepestNode.parentElement.parentElement
              ? deepestNode.parentElement.parentElement
              : deepestNode.parentElement
            : deepestNode;

          /**
           * Recursively delete attributes from Nodes
           */
          const cleanAttributesRecursively = (
            element: Element,
            options: { exceptions: string[] },
          ) => {
            Array.from(element.attributes).forEach((attr) => {
              if (!options.exceptions.includes(attr.name)) {
                element.removeAttribute(attr.name);
              }
            });

            Array.from(element.children).forEach((child) => {
              cleanAttributesRecursively(child, options);
            });
          };

          cleanAttributesRecursively(node, {
            exceptions: allowedAttr,
          });

          // trim and remove white spaces
          return node.outerHTML.trim().replace(/\s+/g, " ");
        }
        return "";
      },
      {
        x,
        y,
        allowedAttr: [
          "type",
          "name",
          "placeholder",
          "aria-label",
          "role",
          "title",
          "alt",
          "d", // for <path> tags
        ],
      },
    );
  }

  private async initialize(): Promise<void> {
    await initializeConfig({});
    this.config = getConfig();

    const initWithRetry = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await this.initializeCursor();
          break;
        } catch (error) {
          this.log.debug("Cursor initialization failed", {
            attempt: i + 1,
            maxAttempts: 3,
            error,
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };

    await initWithRetry();

    this.page.on("load", async () => {
      this.log.trace("Re-initialize on navigation");
      await initWithRetry();
    });
  }

  private async initializeCursor(): Promise<void> {
    try {
      // Simpler check for page readiness
      await this.page
        .waitForLoadState("domcontentloaded", { timeout: 1000 })
        .catch(() => {});

      // Add styles only if they don't exist
      const hasStyles = await this.page
        .evaluate(() => !!document.querySelector("style[data-shortest-cursor]"))
        .catch(() => false);

      if (!hasStyles) {
        // Create style element directly in evaluate
        await this.page.evaluate(() => {
          const style = document.createElement("style");
          style.setAttribute("data-shortest-cursor", "true");
          style.textContent = `
            #ai-cursor {
              width: 20px;
              height: 20px;
              border: 2px solid red;
              border-radius: 50%;
              position: fixed;
              pointer-events: none;
              z-index: 999999;
              transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
              transform: translate(-50%, -50%);
              background-color: rgba(255, 0, 0, 0.2);
            }
            #ai-cursor.clicking {
              transform: translate(-50%, -50%) scale(0.8);
              background-color: rgba(255, 0, 0, 0.4);
            }
            #ai-cursor-trail {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              position: fixed;
              pointer-events: none;
              z-index: 999998;
              background-color: rgba(255, 0, 0, 0.1);
              transition: all 0.1s linear;
              transform: translate(-50%, -50%);
            }
          `;
          document.head.appendChild(style);
        });
      }

      // Initialize cursor elements with position persistence
      await this.page.evaluate(() => {
        if (!document.getElementById("ai-cursor")) {
          const cursor = document.createElement("div");
          cursor.id = "ai-cursor";
          document.body.appendChild(cursor);

          const trail = document.createElement("div");
          trail.id = "ai-cursor-trail";
          document.body.appendChild(trail);

          // Restore or initialize position
          window.cursorPosition ||= { x: 0, y: 0 };
          window.lastPosition ||= { x: 0, y: 0 };

          // Set initial position
          cursor.style.left = window.cursorPosition.x + "px";
          cursor.style.top = window.cursorPosition.y + "px";
          trail.style.left = window.cursorPosition.x + "px";
          trail.style.top = window.cursorPosition.y + "px";

          // Update handler
          const updateCursor = (x: number, y: number) => {
            window.cursorPosition = { x, y };
            cursor.style.left = `${x}px`;
            cursor.style.top = `${y}px`;

            requestAnimationFrame(() => {
              trail.style.left = `${x}px`;
              trail.style.top = `${y}px`;
            });
          };

          document.addEventListener("mousemove", (e) => {
            window.lastPosition = window.cursorPosition;
            updateCursor(e.clientX, e.clientY);
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes("context was destroyed") &&
        !error.message.includes("Target closed")
      ) {
        this.log.error("Cursor initialization failed", getErrorDetails(error));
      }
    }
  }

  private async getMetadata(): Promise<any> {
    const metadata: any = {
      window_info: {},
      cursor_info: { position: [0, 0], visible: true },
    };

    try {
      // Try to get basic page info first
      let url: string;
      let title: string;

      try {
        url = await this.page.url();
      } catch {
        url = "navigating...";
      }

      try {
        title = await this.page.title();
      } catch {
        title = "loading...";
      }

      metadata.window_info = {
        url,
        title,
        size: this.page.viewportSize() || {
          width: this.width,
          height: this.height,
        },
      };

      // Only try to get cursor position if page is stable
      if (await this.isPageStable()) {
        const position = await actions.getCursorPosition(this.page);
        metadata.cursor_info = {
          position,
          visible: this.cursorVisible,
        };
      }

      return metadata;
    } catch (error) {
      this.log.debug("Failed to get metadata:", { error });
      // Return whatever metadata we collected
      return metadata;
    }
  }

  private async isPageStable(): Promise<boolean> {
    try {
      // Quick check if page is in a stable state
      return await this.page
        .evaluate(
          () =>
            document.readyState === "complete" &&
            !document.querySelector(".loading") &&
            !document.querySelector(".cl-loading"),
        )
        .catch(() => false);
    } catch {
      return false;
    }
  }

  private async takeScreenshotWithMetadata(): Promise<ToolResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const testRun = this.testContext.testRun;
    const repository = TestRunRepository.getRepositoryForTestCase(
      testRun.testCase,
    );
    const testRunDirPath = await repository.ensureTestRunDirPath(testRun);
    const screenshotPath = join(testRunDirPath, `screenshot-${timestamp}.png`);

    const buffer = await this.page.screenshot({
      type: "jpeg",
      quality: 50,
      scale: "device",
      fullPage: false,
    });

    await fs.writeFile(screenshotPath, buffer);
    const filePathWithoutCwd = screenshotPath.replace(process.cwd() + "/", "");

    const browserMetadata = await this.getMetadata();
    this.log.trace("Screenshot saved", {
      filePath: filePathWithoutCwd,
      ...browserMetadata["window_info"],
    });

    return {
      output: "Screenshot taken",
      base64_image: buffer.toString("base64"),
      metadata: browserMetadata,
    };
  }
}
