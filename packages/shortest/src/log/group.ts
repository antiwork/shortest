import { Log } from "@/log";
import { LogEvent } from "@/log/event";

/**
 * Represents a hierarchical group of log messages.
 *
 * @class
 * @example
 * ```typescript
 * const log = getLogger();
 * const log.setGroup("Database")
 *   .info("Connecting...")
 *   .debug("Connection established")
 *   .info("Ready");
 * ```
 *
 * @param {Log} log - Logger instance to send messages to
 * @param {string} name - Name of the group
 * @param {LogGroup} [parent] - Optional parent group for nesting
 *
 * @see {@link LogOutput.render} for group rendering
 * @see {@link Log.setGroup} for group management
 *
 * @private
 */
export class LogGroup {
  readonly parent?: LogGroup;
  readonly name: string;
  readonly event: LogEvent;
  private log: Log;

  constructor(log: Log, name: string, parent?: LogGroup) {
    this.log = log;
    this.name = name;
    this.parent = parent;
    this.event = new LogEvent("trace", name);
  }

  /**
   * Logs an info message in this group
   * @returns {this} For method chaining
   */
  info(message: string, metadata?: Record<string, any>) {
    this.log.log("info", message, metadata);
    return this;
  }

  /**
   * Logs a warning message in this group
   * @returns {this} For method chaining
   */
  warn(message: string, metadata?: Record<string, any>) {
    this.log.log("warn", message, metadata);
    return this;
  }

  /**
   * Logs an error message in this group
   * @returns {this} For method chaining
   */
  error(message: string, metadata?: Record<string, any>) {
    this.log.log("error", message, metadata);
    return this;
  }

  /**
   * Logs a debug message in this group
   * @returns {this} For method chaining
   */
  debug(message: string, metadata?: Record<string, any>) {
    this.log.log("debug", message, metadata);
    return this;
  }

  /**
   * Logs a trace message in this group
   * @returns {this} For method chaining
   */
  trace(message: string, metadata?: Record<string, any>) {
    this.log.log("trace", message, metadata);
    return this;
  }

  /**
   * Gets array of group names from root to this group
   * @returns {string[]} Array of group names in hierarchical order
   */
  getGroupIdentifiers(): string[] {
    const identifiers: string[] = [];
    let current: LogGroup | undefined = this;
    while (current) {
      identifiers.unshift(current.name);
      current = current.parent;
    }
    return identifiers;
  }
}
