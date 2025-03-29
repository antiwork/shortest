import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { detectSupportedFramework } from "@/core/app-analyzer";
import { TestGenerator } from "@/core/test-generator";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";

export const generateCommand = new Command("generate").description(
  "Generate tests from test plans",
);

generateCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .addOption(
    new Option(
      "--force",
      "Force test generation even if cached data exists",
    ).default(false),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeGenerateCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeGenerateCommand = async (
  options: { force?: boolean } = {},
): Promise<void> => {
  const log = getLogger();
  const cwd = process.cwd();
  const supportedFramework = await detectSupportedFramework();
  log.info(`Generating tests...`);

  const generator = new TestGenerator(cwd, supportedFramework);
  await generator.execute(options);

  log.info(`Test generation complete.`);
};
