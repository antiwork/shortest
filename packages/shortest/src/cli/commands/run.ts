import { cleanUpCache } from "@/cache";
import { purgeLegacyScreenshots } from "@/cache";
import { purgeLegacyCache } from "@/cache";
import { TestRunner } from "@/core/runner";
import { getConfig, initializeConfig } from "@/index";
import { getLogger } from "@/log";
import { CLIOptions } from "@/types";
import { getErrorDetails, ShortestError } from "@/utils/errors";

export const executeRunCommand = async (testPattern: string, options: any) => {
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
