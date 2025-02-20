import { TestContext, Page } from "@/types/test";

export interface BrowserToolInterface {
  waitForSelector(
    selector: string,
    options?: { timeout: number },
  ): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  findElement(selector: string): Promise<any>;
  waitForNavigation(options?: { timeout: number }): Promise<void>;
  click(selector: string): Promise<void>;
  getPage(): Page;
}

export enum BrowserActionEnum {
  MouseMove = "mouse_move",
  LeftClick = "left_click",
  LeftClickDrag = "left_click_drag",
  RightClick = "right_click",
  MiddleClick = "middle_click",
  DoubleClick = "double_click",
  Screenshot = "screenshot",
  CursorPosition = "cursor_position",
  GithubLogin = "github_login",
  ClearSession = "clear_session",
  Type = "type",
  Key = "key",
  RunCallback = "run_callback",
  Navigate = "navigate",
  Sleep = "sleep",
  CheckMail = "check_email",
}

// eslint-disable-next-line zod/require-zod-schema-types
export type BrowserAction = `${BrowserActionEnum}`;

export interface BrowserToolOptions {
  width: number;
  height: number;
  displayNum?: number;
  screenshotDelay?: number;
}

export interface ActionInput {
  action: BrowserAction;
  coordinates?: number[];
  text?: string;
  username?: string;
  password?: string;
  url?: string;
  duration?: number;
  email?: string;
}

export interface ToolResult {
  output?: string;
  error?: string;
  base64_image?: string;
  metadata?: {
    window_info?: {
      url: string;
      title: string;
      size: { width: number; height: number };
    };
    cursor_info?: {
      position: [number, number];
      visible: boolean;
    };
  };
}

export interface BrowserConfig {
  name: "chrome" | "firefox" | "safari" | "edge";
  headless?: boolean;
  width?: number;
  height?: number;
  displayNum?: number;
}

export interface BrowserToolConfig {
  width: number;
  height: number;
  testContext?: TestContext;
}

// eslint-disable-next-line zod/require-zod-schema-types
export type BetaToolType =
  | "computer_20241022"
  | "text_editor_20241022"
  | "bash_20241022";

export interface BetaToolParams {
  type: BetaToolType;
  name: string;
  display_width_px?: number;
  display_height_px?: number;
  display_number?: number;
}
