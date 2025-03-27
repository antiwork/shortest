import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { SUPPORTED_FRAMEWORKS } from "@/core/app-analyzer";
import { getProjectInfo } from "@/core/framework-detector";
import { TestGenerator } from "@/core/test-generator";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";
import { ShortestError } from "@/utils/errors";

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
  const projectInfo = await getProjectInfo();
  const supportedFrameworks = projectInfo.data.frameworks.filter((f) =>
    SUPPORTED_FRAMEWORKS.includes(f.id),
  );

  if (supportedFrameworks.length === 0) {
    throw new ShortestError(`No supported framework found`);
  }

  if (supportedFrameworks.length > 1) {
    throw new ShortestError(
      `Multiple supported frameworks found: ${supportedFrameworks.map((f) => f.name).join(", ")}`,
    );
  }

  const framework = supportedFrameworks[0];
  log.info(`Generating tests for ${framework.name} application...`);

  const generator = new TestGenerator(cwd, framework.id);
  await generator.execute(options);

  log.info(`Test generation complete.`);
};
