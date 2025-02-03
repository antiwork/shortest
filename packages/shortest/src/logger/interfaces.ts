export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level: LogLevel;
}

export interface LogLine {
  /**
   * The severity of the log message.
   *
   * - "error" - test failures and critical issues
   * - "warn" - above + non-critical issues, deprecations
   * - "info" - above + test progress (default)
   * - "debug" - above + detailed info including AI conversations, browser actions, etc
   */
  level: LogLevel;

  /**
   * A human-readable message describing the event being logged.
   */
  message: string;
}

export interface ILogger {
  /**
   * Logs a structured message to the console or external systems.
   * @param line The structured log object containing level, message, and optional context.
   */
  log(line: LogLine): void;
}
