import { anthropic } from "@ai-sdk/anthropic";
import { BashTool } from "@/browser/core/bash-tool";

/**
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#bash-tool
 */
export const createAnthropicBash20241022 = () =>
  anthropic.tools.bash_20241022({
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
