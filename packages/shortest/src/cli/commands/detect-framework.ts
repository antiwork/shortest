import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { detectFramework } from "@/core/framework-detector";
import { LOG_LEVELS } from "@/log/config";

export const detectFrameworkCommand = new Command(
  "detect-framework",
).description("Detect the framework(s) of the current project");

detectFrameworkCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .addOption(
    new Option("--force", "Force detection even if cached data exists").default(
      false,
    ),
  )
  .action(async function () {
    await executeCommand(
      this.name(),
      this.optsWithGlobals(),
      async () => await executeDetectFrameworkCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeDetectFrameworkCommand = async (
  options: { force?: boolean } = {},
) => {
  await detectFramework(options);
};
