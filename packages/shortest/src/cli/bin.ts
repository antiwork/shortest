#!/usr/bin/env node
import pc from "picocolors";
import {
  shortestCommand,
  githubCodeCommand,
  initCommand,
  cacheCommands,
  clearCommand,
  detectFrameworkCommand,
} from "@/cli/commands";
import { getLogger } from "@/log/index";
import { ShortestError } from "@/utils/errors";

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return;
  }
  console.warn(warning);
});

shortestCommand.addCommand(initCommand);
initCommand.copyInheritedSettings(shortestCommand);

shortestCommand.addCommand(githubCodeCommand);
githubCodeCommand.copyInheritedSettings(shortestCommand);

shortestCommand.addCommand(cacheCommands);
cacheCommands.copyInheritedSettings(shortestCommand);
clearCommand.copyInheritedSettings(cacheCommands);

shortestCommand.addCommand(detectFrameworkCommand);
detectFrameworkCommand.copyInheritedSettings(shortestCommand);

const main = async () => {
  try {
    await shortestCommand.parseAsync();
    process.exit(0);
  } catch (error) {
    const log = getLogger();
    log.trace("Handling error on main()");
    if (!(error instanceof ShortestError)) throw error;

    console.error(pc.red(error.name), error.message);
    process.exit(1);
  }
};

main().catch(async (error) => {
  const log = getLogger();
  log.trace("Handling error in main catch block");
  if (!(error instanceof ShortestError)) throw error;

  console.error(pc.red(error.name), error.message);
  process.exit(1);
});
