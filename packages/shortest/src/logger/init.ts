import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { LogLevel } from "./interfaces";
import { EMOJIS } from "./constants";

export function getLogLevel(): LogLevel {
  const argv = yargs(hideBin(process.argv))
    .option("log-level", {
      type: "string",
      description: "Set the log level",
      choices: ["debug", "info", "warn", "error"],
      default: "info",
    })
    .option("debug-ai", {
      type: "boolean",
      description: "Alias for --log-level=debug (deprecated)",
      default: false,
    })
    .parseSync();

  let level: LogLevel = argv["log-level"] as LogLevel;

  if (argv["debug-ai"]) {
    level = "debug";
    console.warn(
      `${EMOJIS.warning} Deprecated: --debug-ai flag, use --log-level=debug instead`,
    );
  }

  return level;
}

export const GLOBAL_LOG_LEVEL = getLogLevel();
