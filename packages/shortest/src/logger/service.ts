import { LEVEL_PRIORITY } from "./constants";
import { ILogger, LoggerOptions, LogLevel, LogLine } from "./interfaces";

export class Logger implements ILogger {
  private options: LoggerOptions;

  constructor(options: LoggerOptions) {
    this.options = options;
  }

  log(line: LogLine): void {
    if (!this.shouldLog(line.level)) return;
    process.stdout.write(line.message);
  }

  private shouldLog(logLevel: LogLevel): boolean {
    return LEVEL_PRIORITY[logLevel] >= LEVEL_PRIORITY[this.options.level];
  }
}
