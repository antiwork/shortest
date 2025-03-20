import { Command } from "commander";
import pc from "picocolors";
import { cleanUpCache } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";

export const cacheCommands = new Command("cache").description(
  "Cache management commands",
);

const clearCommand = new Command("clear")
  .description("Clear test cache")
  .option("--force-purge", "Force purge of all cache files", false)
  .configureOutput({
    outputError: (str, write) => write(pc.red(str)),
  })
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () => {
      await cleanUpCache({ forcePurge: this.opts().forcePurge });
    });
  })
  .showHelpAfterError("(add --help for additional information)");

cacheCommands.addCommand(clearCommand);
