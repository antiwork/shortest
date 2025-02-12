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
 *
 * @private
 */
export class LogEvent {
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

  get parsedMetadata(): Record<string, any> | undefined {
    return (
      this._parsedMetadata ?? (this._parsedMetadata = this.parseMetadata())
    );
  }

  private parseMetadata(): Record<string, any> | undefined {
    if (!Object.keys(this.metadata).length) return undefined;

    return Object.fromEntries(
      Object.entries(this.metadata).map(([k, v]) => [
        k,
        LogEvent.filterValue(k, v, 0),
      ]),
    );
  }

  private static filterValue(key: string, value: any, depth: number): any {
    const FILTERED_METADATA_KEYS = ["apiKey", "base64_image"];
    const MAX_METADATA_DEPTH = 4;
    const FILTERED_PLACEHOLDER = "[FILTERED]";
    const TRUNCATED_PLACEHOLDER = "[TRUNCATED]";

    if (depth > MAX_METADATA_DEPTH) {
      return TRUNCATED_PLACEHOLDER;
    }

    if (FILTERED_METADATA_KEYS.includes(key)) {
      return FILTERED_PLACEHOLDER;
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
}
