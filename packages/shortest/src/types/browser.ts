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

export enum InternalActionEnum {
  MOUSE_MOVE = "mouse_move",
  LEFT_CLICK = "left_click",
  LEFT_CLICK_DRAG = "left_click_drag",
  RIGHT_CLICK = "right_click",
  MIDDLE_CLICK = "middle_click",
  DOUBLE_CLICK = "double_click",
  TRIPLE_CLICK = "triple_click",
  SCREENSHOT = "screenshot",
  CURSOR_POSITION = "cursor_position",
  GITHUB_LOGIN = "github_login",
  CLEAR_SESSION = "clear_session",
  TYPE = "type",
  KEY = "key",
  HOLD_KEY = "hold_key",
  RUN_CALLBACK = "run_callback",
  NAVIGATE = "navigate",
  SLEEP = "sleep",
  CHECK_EMAIL = "check_email",
  LEFT_MOUSE_DOWN = "left_mouse_down",
  LEFT_MOUSE_UP = "left_mouse_up",
  WAIT = "wait",
  SCROLL = "scroll",
}

// eslint-disable-next-line zod/require-zod-schema-types
export type BrowserAction = `${InternalActionEnum}`;

export interface BrowserToolOptions {
  width: number;
  height: number;
  displayNum?: number;
  screenshotDelay?: number;
}

export interface ActionInput {
  action: BrowserAction;
  coordinate?: number[];
  coordinates?: number[];
  text?: string;
  username?: string;
  password?: string;
  url?: string;
  duration?: number;
  email?: string;
  scroll_amount?: number;
  scroll_direction?: string;
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
  testContext: TestContext;
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
