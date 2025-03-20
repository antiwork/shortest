// import { Command } from "commander";
import { cacheCommands } from "@/cli/commands/cache";
import { githubCodeCommand } from "@/cli/commands/github-code";
import { initCommand } from "@/cli/commands/init";
import { executeRunCommand } from "@/cli/commands/run";
import {
  createShortestCommand,
  executeCommand,
} from "@/cli/utils/command-builder";

export { githubCodeCommand, initCommand, cacheCommands };
export { executeRunCommand };
export { createShortestCommand, executeCommand };
