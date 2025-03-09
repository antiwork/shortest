import { z } from "zod";
import { createAnthropicBash20241022 } from "@/ai/tools/anthropic/bash_20241022";
import { createAnthropicBash20250124 } from "@/ai/tools/anthropic/bash_20250124";
import { createAnthropicComputer20241022 } from "@/ai/tools/anthropic/computer_20241022";
import { createAnthropicComputer20250124 } from "@/ai/tools/anthropic/computer_20250124";
import { createCheckEmailTool } from "@/ai/tools/custom/check_email";
import { createGithubLoginTool } from "@/ai/tools/custom/github_login";
import { createNavigateTool } from "@/ai/tools/custom/navigate";
import { createRunCallbackTool } from "@/ai/tools/custom/run_callback";
import { createSleepTool } from "@/ai/tools/custom/sleep";
import {
  anthropicToolTypeSchema,
  toolFactorySchema,
  ToolRegistry,
} from "@/tools/tool-registry";

export { ToolRegistry };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toolToRegisterSchema = z.union([
  z.object({
    name: anthropicToolTypeSchema,
    category: z.literal("provider"),
    factory: toolFactorySchema,
  }),
  z.object({
    name: z.string(),
    category: z.literal("custom"),
    factory: toolFactorySchema,
  }),
]);
type ToolToRegister = z.infer<typeof toolToRegisterSchema>;

/**
 * Creates and configures a new ToolRegistry with all available tools
 *
 * @returns Configured ToolRegistry instance with all tools registered
 *
 * @private
 */
export const createToolRegistry = (): ToolRegistry => {
  const toolRegistry = new ToolRegistry();
  const toolsToRegister: Record<string, ToolToRegister> = {
    anthropic_computer_20241022: {
      name: "computer",
      category: "provider",
      factory: createAnthropicComputer20241022,
    },
    anthropic_computer_20250124: {
      name: "computer",
      category: "provider",
      factory: createAnthropicComputer20250124,
    },
    anthropic_bash_20241022: {
      name: "bash",
      category: "provider",
      factory: createAnthropicBash20241022,
    },
    anthropic_bash_20250124: {
      name: "bash",
      category: "provider",
      factory: createAnthropicBash20250124,
    },
    check_email: {
      name: "check_email",
      category: "custom",
      factory: createCheckEmailTool,
    },
    github_login: {
      name: "github_login",
      category: "custom",
      factory: createGithubLoginTool,
    },
    navigate: {
      name: "navigate",
      category: "custom",
      factory: createNavigateTool,
    },
    run_callback: {
      name: "run_callback",
      category: "custom",
      factory: createRunCallbackTool,
    },
    sleep: {
      name: "sleep",
      category: "custom",
      factory: createSleepTool,
    },
  };
  Object.entries(toolsToRegister).forEach(([key, value]) => {
    toolRegistry.registerTool(key, value);
  });
  return toolRegistry;
};
