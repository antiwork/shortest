import { LogLevel } from "./config";

/**
 * Represents a log event in the logging system.
 *
 * @class
 * @example
 * ```typescript
 * const event = new LogEvent("info", "User logged in", { userId: 123 });
 * ```
 *
 * @param {LogLevel} level - Log severity level (trace|debug|info|warn|error|silent)
 * @param {string} message - Main log message
 * @param {Record<string, any>} [metadata] - Optional key-value pairs for additional context
 *
 * @see {@link LogOutput.render} for rendering implementation
 * @see {@link LogGroup} for grouping functionality
 * @see {@link Log.outputEvent} for event processing
 *
 * @private
 */
export class LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any> = {};

  constructor(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.message = message;
    this.metadata = metadata ?? {};
  }
}
