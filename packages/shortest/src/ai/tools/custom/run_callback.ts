import { tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";

export const createRunCallbackTool = (browserTool: BrowserTool) =>
  tool({
    description: "Run callback function for current test step",
    parameters: z.object({
      action: z.literal("run_callback"),
    }),
    execute: browserTool.execute.bind(browserTool),
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });
