import { cacheCommands, clearCommand } from "@/cli/commands/cache";
import { detectFrameworkCommand } from "@/cli/commands/detect-framework";
import { githubCodeCommand } from "@/cli/commands/github-code";
import { initCommand } from "@/cli/commands/init";
import { shortestCommand } from "@/cli/commands/shortest";

export {
  shortestCommand,
  githubCodeCommand,
  initCommand,
  cacheCommands,
  clearCommand,
  detectFrameworkCommand,
};
