import { tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";

export const createCheckEmailTool = (browserTool: BrowserTool) =>
  tool({
    description: "View received email in new browser tab",
    parameters: z.object({
      action: z.literal("check_email"),
      email: z.string().describe("Email content or address to check for"),
    }),
    execute: browserTool.execute.bind(browserTool),
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });
