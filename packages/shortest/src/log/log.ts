import { LOG_LEVELS, LogLevel, LogConfig, LogConfigSchema } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";
import { LogOutput } from "./output";

/**
 * Core logging class that handles log filtering, grouping, and output rendering.
 *
 * @class
 * @example
 * ```typescript
 * const log = new Log({ level: "debug", format: "terminal" });
 * log.info("Server started", { port: 3000 });
 *
 * // Group related logs
 * log.setGroup("Database");
 * log.debug("Connecting to database...");
 * log.info("Connected successfully");
 * log.resetGroup();
 * ```
 *
 * @param {Partial<LogConfig>} [config] - Optional logger configuration
 * @see {@link LogConfigSchema} for config validation
 * @see {@link LogOutput} for output formatting
 * @see {@link LogGroup} for log grouping
 * @see {@link LogEvent} for event structure
 *
 * @private
 */
export class Log {
  readonly config: LogConfig;
  // private events: LogEvent[] = [];
  private currentGroup?: LogGroup;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = LogConfigSchema.parse(config);
  }

  /**
   * Checks if a log level should be output based on configured minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVELS.indexOf(level) >=
      LOG_LEVELS.indexOf(this.config.level as LogLevel)
    );
  }

  /**
   * Processes and outputs a log event if it meets the minimum level requirement
   */
  private outputEvent(event: LogEvent): void {
    if (!this.shouldLog(event.level)) return;
    LogOutput.render(event, this.config.format, this.currentGroup);
  }

  /**
   * Core logging method that handles metadata extraction and event creation
   */
  log(level: LogLevel, ...args: any[]) {
    const metadata =
      args[args.length - 1]?.constructor === Object ? args.pop() : undefined;
    const message = args.join(" ");
    const event = new LogEvent(level, message, metadata);
    this.outputEvent(event);
  }

  /**
   * Creates a new log group for organizing related logs
   */
  setGroup(name: string): void {
    this.log("trace", "Setting group", { groupName: name });
    this.currentGroup = new LogGroup(this, name, this.currentGroup);
  }

  /**
   * Resets to parent group or removes grouping if at root
   */
  resetGroup(): void {
    if (this.currentGroup) {
      this.log("trace", "Resetting group", {
        groupName: this.currentGroup.name,
      });
      this.currentGroup = this.currentGroup?.parent;
    } else {
      this.log("trace", "No group to reset");
    }
  }

  /**
   * Removes all group nesting
   */
  resetAllGroups(): void {
    this.log("trace", "Resetting all groups");
    this.currentGroup = undefined;
  }

  /**
   * Convenience methods for different log levels
   */
  trace(...args: any[]) {
    this.log("trace", ...args);
  }

  debug(...args: any[]) {
    this.log("debug", ...args);
  }

  info(...args: any[]) {
    this.log("info", ...args);
  }

  warn(...args: any[]) {
    this.log("warn", ...args);
  }

  error(...args: any[]) {
    this.log("error", ...args);
  }
}
