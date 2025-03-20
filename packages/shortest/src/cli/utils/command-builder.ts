import { LogLevel } from "@/log/config";
import { getLogger } from "@/log/index";
import { getErrorDetails } from "@/utils/errors";

interface GlobalOptions {
  logLevel?: LogLevel;
  headless?: boolean;
  target?: string;
  cache?: boolean;
}

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
