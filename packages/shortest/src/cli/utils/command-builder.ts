import { Command, Option } from "commander";
import { LOG_LEVELS, LogLevel } from "@/log/config";
import { getLogger } from "@/log/index";
import { cliOptionsSchema } from "@/types/config";
import { getErrorDetails } from "@/utils/errors";
export interface GlobalOptions {
  logLevel?: LogLevel;
  headless?: boolean;
  target?: string;
  cache?: boolean;
}

const { version: currentVersion } = require("../../../package.json");

export const createShortestCommand = (name: string) =>
  new Command(name)
    .description("AI-powered end-to-end testing framework")
    .version(currentVersion)
    .addOption(
      new Option("--log-level <level>", "Set logging level").choices(
        LOG_LEVELS,
      ),
    )
    .option("--headless", "Run tests in headless browser mode")
    .option(
      "--target <url>",
      "Set target URL for tests",
      cliOptionsSchema.shape.baseUrl._def.defaultValue(),
    )
    .option("--no-cache", "Disable test action caching");

export const executeCommand = async (
  name: string,
  options: GlobalOptions,
  fn: (options: GlobalOptions) => Promise<void>,
) => {
  const log = getLogger({
    level: options.logLevel as LogLevel,
  });

  try {
    log.trace(`Executing ${name} command`, { options });
    await fn(options);
  } catch (error) {
    log.error(`Command ${name} failed`, getErrorDetails(error));
    throw error;
  }
};
