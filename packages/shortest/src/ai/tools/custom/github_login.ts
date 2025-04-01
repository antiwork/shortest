import { tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";

export const createGithubLoginTool = (browserTool: BrowserTool) =>
  tool({
    description: "Handle GitHub OAuth login with 2FA",
    parameters: z.object({
      action: z.literal("github_login"),
      username: z.string(),
      password: z.string(),
    }),
    execute: browserTool.execute.bind(browserTool),
    experimental_toToolResultContent: browserTool.resultToToolResultContent,
  });
