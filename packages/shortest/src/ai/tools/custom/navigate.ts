import { tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";

export const createNavigateTool = (browserTool: BrowserTool) =>
  tool({
    description: "Navigate to URLs in new browser tab",
    parameters: z.object({
      action: z.literal("navigate"),
      url: z.string().url().describe("The URL to navigate to"),
    }),
    execute: browserTool.execute.bind(browserTool),
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });
