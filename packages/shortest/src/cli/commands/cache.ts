import { Command, Option } from "commander";
import { cleanUpCache } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { LOG_LEVELS } from "@/log/config";

export const cacheCommands = new Command("cache").description(
  "Cache management commands",
);

const clearCommand = new Command("clear").description("Clear test cache");

clearCommand
  .option("--force-purge", "Force purge of all cache files", false)
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () => {
      await cleanUpCache({ forcePurge: this.opts().forcePurge });
    });
  })
  .showHelpAfterError("(add --help for additional information)");

cacheCommands.addCommand(clearCommand);
