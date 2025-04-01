import { anthropic } from "@ai-sdk/anthropic";
import { Tool } from "ai";
import { BrowserTool } from "@/browser/core/browser-tool";
import { getLogger } from "@/log";
import { InternalActionEnum } from "@/types/browser";

/**
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#computer-tool
 */
export const createAnthropicComputer20250124 = (
  browserTool: BrowserTool,
): Tool =>
  anthropic.tools.computer_20250124({
    displayWidthPx: 1920,
    displayHeightPx: 1080,
    displayNumber: 0,
    execute: async (input) => {
      const { action, ...restOfInput } = input;
      const internalAction = actionMap[action];
      if (!internalAction) {
        const log = getLogger();
        log.error(`Computer action not supported`, {
          tool: "anthropic.computer_20250124",
          action,
        });
        return { output: `Action '${action}' not supported` };
      }
      return await browserTool.execute({
        action: internalAction,
        ...restOfInput,
      });
    },
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });

/**
 * Map of Anthropic computer_20250124 actions to internal actions
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/computer-use#computer-tool
 */
const actionMap: Record<string, InternalActionEnum> = {
  key: InternalActionEnum.KEY,
  hold_key: InternalActionEnum.HOLD_KEY,
  type: InternalActionEnum.TYPE,
  cursor_position: InternalActionEnum.CURSOR_POSITION,
  mouse_move: InternalActionEnum.MOUSE_MOVE,
  left_mouse_down: InternalActionEnum.LEFT_MOUSE_DOWN,
  left_mouse_up: InternalActionEnum.LEFT_MOUSE_UP,
  left_click: InternalActionEnum.LEFT_CLICK,
  left_click_drag: InternalActionEnum.LEFT_CLICK_DRAG,
  right_click: InternalActionEnum.RIGHT_CLICK,
  middle_click: InternalActionEnum.MIDDLE_CLICK,
  double_click: InternalActionEnum.DOUBLE_CLICK,
  triple_click: InternalActionEnum.TRIPLE_CLICK,
  scroll: InternalActionEnum.SCROLL,
  wait: InternalActionEnum.WAIT,
  screenshot: InternalActionEnum.SCREENSHOT,
};
