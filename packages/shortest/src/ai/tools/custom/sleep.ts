import { tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";

export const createSleepTool = (browserTool: BrowserTool) =>
  tool({
    description: "Pause test execution for specified duration",
    parameters: z.object({
      action: z.literal("sleep"),
      duration: z.number().min(0).max(60000),
    }),
    execute: browserTool.execute.bind(browserTool),
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });
