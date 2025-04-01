import {
  BrowserToolOptions,
  ActionInput,
  ToolResult,
  BetaToolType,
} from "@/types/browser";
import { ToolError } from "@/utils/errors";

export abstract class BaseBrowserTool {
  protected width: number;
  protected height: number;
  protected displayNum: number;
  protected screenshotDelay: number;
  protected readonly toolType: BetaToolType = "computer_20241022";
  protected readonly toolName: string = "computer";

  constructor(options: BrowserToolOptions) {
    this.width = options.width;
    this.height = options.height;
    this.displayNum = options.displayNum || 1;
    this.screenshotDelay = options.screenshotDelay || 2000;
  }

  abstract execute(input: ActionInput): Promise<ToolResult>;

  abstract toToolParameters(): {
    type: BetaToolType;
    name: string;
    display_width_px: number;
    display_height_px: number;
    display_number: number;
  };

  protected validateCoordinates(x: number, y: number): void {
    if (x < 0 || x > this.width || y < 0 || y > this.height) {
      throw new ToolError(`Coordinates (${x}, ${y}) out of bounds`);
    }
  }

  protected formatToolResult(
    output?: string,
    error?: string,
    base64_image?: string,
    metadata?: ToolResult["metadata"],
  ): ToolResult {
    return {
      output,
      error,
      base64_image,
      metadata,
    };
  }
}
