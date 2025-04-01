import { Writable } from "node:stream";
import pc from "picocolors";
import { z } from "zod";
import { LOG_LEVELS, LogLevel, LogConfig, LogConfigSchema } from "@/log/config";
import { LogEvent } from "@/log/event";
import { LogGroup } from "@/log/group";
import { LogOutput } from "@/log/output";
import { formatZodError, ConfigError } from "@/utils/errors";

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
  private outputStream: Writable;

  constructor(config: Partial<LogConfig> = {}) {
    try {
      this.config = LogConfigSchema.parse(config);
      this.outputStream = process.stdout;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigError(
          "invalid-config",
          formatZodError(error, "Invalid shortest.config"),
        );
      }
      throw error;
    }
  }

  /**
   * Core logging method that handles metadata extraction and event creation
   */
  log(level: LogLevel, ...args: any[]) {
    const metadata =
      args[args.length - 1]?.constructor === Object ? args.pop() : undefined;
    const message = args.map((arg) => String(arg)).join(" ");
    const event = new LogEvent(level, message, metadata);
    this.outputEvent(event);
  }

  /**
   * Creates a new log group for organizing related logs
   */
  setGroup(name: string): void {
    // Useful for additional logging
    // const callerMatch = new Error().stack
    //   ?.split("\n")[2]
    //   ?.match(/at\s+(\S+)\s+/);
    // this.log("trace", "Setting group", {
    //   groupName: name,
    //   calledBy: callerMatch?.[1] || "unknown",
    // });
    this.currentGroup = new LogGroup(this, name, this.currentGroup);
  }

  /**
   * Resets to parent group or removes grouping if at root
   */
  resetGroup(): void {
    const callerMatch = new Error().stack
      ?.split("\n")[2]
      ?.match(/at\s+(\S+)\s+/);
    if (this.currentGroup) {
      // Useful for additional logging
      // this.log("trace", "Resetting group", {
      //   groupName: this.currentGroup.name,
      //   calledBy: callerMatch?.[1] || "unknown",
      // });
      this.currentGroup = this.currentGroup?.parent;
    } else {
      this.log("trace", "No group to reset", {
        calledBy: callerMatch?.[1] || "unknown",
      });
    }
  }

  /**
   * Removes all group nesting
   */
  resetAllGroups(): void {
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

  setOutputStream(stream: Writable): this {
    this.outputStream = stream;
    return this;
  }

  resetOutputStream(): this {
    this.outputStream = process.stdout;
    return this;
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
    if (this.shouldLog(event.level)) {
      LogOutput.render(
        event,
        this.config.format,
        this.outputStream,
        this.currentGroup,
      );
    } else if (event.level === "warn") {
      console.warn(
        pc.bgYellowBright(pc.black(" WARN ")),
        pc.yellow(event.message),
      );
    }
  }
}
