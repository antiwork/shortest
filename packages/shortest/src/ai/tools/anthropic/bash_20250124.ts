import { anthropic } from "@ai-sdk/anthropic";
import { BashTool } from "@/browser/core/bash-tool";

/**
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#bash-tool
 */
export const createAnthropicBash20250124 = () =>
  anthropic.tools.bash_20250124({
    execute: async ({ command }) => await new BashTool().execute(command),
    experimental_toToolResultContent(result) {
      return [
        {
          type: "text",
          text: result,
        },
      ];
    },
  });
