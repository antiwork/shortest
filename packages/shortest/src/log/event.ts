import { LogLevel } from "@/log/config";

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
 *
 * @private
 */
export class LogEvent {
  static readonly FILTERED_METADATA_KEYS = ["anthropicKey", "apiKey"];
  static readonly FILTERED_PLACEHOLDER = "[FILTERED]";
  static readonly TRUNCATED_METADATA_KEYS = ["base64_image", "data"];
  static readonly TRUNCATED_PLACEHOLDER = "[TRUNCATED]";

  /**
   * Recursively processes and filters values in metadata:
   * - Truncates nested objects beyond certain depth
   * - Masks sensitive keys (e.g., API keys) with [FILTERED] or partial value
   * - Truncates specified large fields with [TRUNCATED]
   * - Formats multiline strings with indentation
   * - Attempts JSON parsing of string values
   *
   * @param {string} key - Metadata key being processed
   * @param {any} value - Value to filter/process
   * @param {number} depth - Current recursion depth
   * @returns {any} Processed value
   *
   * @private
   */
  static filterValue(key: string, value: any, depth: number): any {
    const MAX_METADATA_DEPTH = 5;

    if (depth > MAX_METADATA_DEPTH) {
      return LogEvent.TRUNCATED_PLACEHOLDER;
    }

    if (LogEvent.TRUNCATED_METADATA_KEYS.includes(key)) {
      return typeof value === "string"
        ? `${value.slice(0, 8)}...`
        : LogEvent.TRUNCATED_PLACEHOLDER;
    }

    if (LogEvent.FILTERED_METADATA_KEYS.includes(key)) {
      if (typeof value === "string") {
        if (value.length < 6) {
          return LogEvent.FILTERED_PLACEHOLDER;
        } else if (value.length < 15) {
          return `${value.slice(0, 3)}...`;
        }
        return `${value.slice(0, 3)}...${value.slice(-3)}`;
      }
      return LogEvent.FILTERED_PLACEHOLDER;
    }

    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          LogEvent.filterValue(k, v, depth + 1),
        ]),
      );
    }

    if (typeof value === "string" && value.includes("\n")) {
      return "\n  " + value.split("\n").join("\n  ");
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly metadata: Record<string, any> = {};

  private _parsedMetadata: Record<string, any> | undefined | null = null;

  constructor(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ) {
    this.timestamp = new Date();
    this.level = level;
    this.message = message;
    this.metadata = metadata ?? {};
  }

  get parsedMetadata():
    | Record<string, string | number | boolean | null | object>
    | undefined {
    return (this._parsedMetadata ??= this.parseMetadata());
  }

  private parseMetadata():
    | Record<string, string | number | boolean | null | object>
    | undefined {
    if (!Object.keys(this.metadata).length) return undefined;

    return Object.fromEntries(
      Object.entries(this.metadata).map(([k, v]) => [
        k,
        LogEvent.filterValue(k, v, 0),
      ]),
    );
  }
}
