import { Command, Option } from "commander";
import pc from "picocolors";
import {
  cleanUpCache,
  purgeLegacyScreenshots,
  purgeLegacyCache,
} from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { ENV_LOCAL_FILENAME } from "@/constants";
import { TestRunner } from "@/core/runner";
import { getConfig, initializeConfig } from "@/index";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";
import { CLIOptions, cliOptionsSchema } from "@/types/config";
import { getErrorDetails, ShortestError } from "@/utils/errors";

export const SHORTEST_NAME = "shortest";
const { version: currentVersion } = require("../../../package.json");

export const shortestCommand = new Command(SHORTEST_NAME)
  .description(`${pc.cyan("AI-powered end-to-end testing framework")}`)
  .version(currentVersion)
  .configureHelp({
    styleTitle: (title) => pc.bold(title),
  })
  .configureOutput({
    outputError: (str, write) => write(pc.red(str)),
  })
  .showHelpAfterError("(add --help for additional information)")
  .addHelpText(
    "after",
    `
${pc.bold("Environment setup:")}
  Required in ${ENV_LOCAL_FILENAME}:
    AI authentication
      SHORTEST_ANTHROPIC_API_KEY                  Anthropic API key for AI test execution
      ANTHROPIC_API_KEY                           Alternative Anthropic API key (only one is required)

${pc.bold("Documentation:")}
  ${pc.cyan("https://github.com/antiwork/shortest")}
`,
  );

shortestCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .option("--headless", "Run tests in headless browser mode")
  .option(
    "--target <url>",
    "Set target URL for tests",
    cliOptionsSchema.shape.baseUrl._def.defaultValue(),
  )
  .option("--no-cache", "Disable test action caching")
  .argument(
    "[test-pattern]",
    "Test pattern to run",
    cliOptionsSchema.shape.testPattern._def.defaultValue(),
  )
  .action(async (testPattern, _options, command) => {
    await executeCommand(
      command.name(),
      command.optsWithGlobals(),
      async () =>
        await executeTestRunnerCommand(testPattern, command.optsWithGlobals()),
    );
  });

const executeTestRunnerCommand = async (testPattern: string, options: any) => {
  const log = getLogger();

  log.trace("Starting Shortest CLI", { args: process.argv });
  log.trace("Log config", { ...log.config });

  let lineNumber: number | undefined;

  if (testPattern?.includes(":")) {
    const [file, line] = testPattern.split(":");
    testPattern = file;
    lineNumber = parseInt(line, 10);
  }

  const cliOptions: CLIOptions = {
    headless: options.headless,
    baseUrl: options.target,
    testPattern,
    noCache: !options.cache,
  };

  log.trace("Initializing config with CLI options", { cliOptions });
  await initializeConfig({ cliOptions });
  const config = getConfig();

  await purgeLegacyCache();
  await purgeLegacyScreenshots();

  try {
    log.trace("Initializing TestRunner");
    const runner = new TestRunner(process.cwd(), config);
    await runner.initialize();
    const success = await runner.execute(config.testPattern, lineNumber);
    process.exitCode = success ? 0 : 1;
  } catch (error: any) {
    log.trace("Handling error for TestRunner");
    if (!(error instanceof ShortestError)) throw error;

    log.error(error.message, getErrorDetails(error));
    process.exitCode = 1;
  } finally {
    await cleanUpCache();
  }
};
