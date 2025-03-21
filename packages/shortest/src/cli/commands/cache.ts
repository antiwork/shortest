import { Command, Option } from "commander";
import { cleanUpCache } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { LOG_LEVELS } from "@/log/config";

export const cacheCommands = new Command("cache").description(
  "Cache management commands",
);

export const clearCommand = new Command("clear").description(
  "Clear test cache",
);

clearCommand
  .option("--force-purge", "Force purge of all cache files", false)
  // This is needed to show in help without calling showGlobalOptions, which would show all global options that
  // are not relevant (e.g. --headless, --target, --no-cache)
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
