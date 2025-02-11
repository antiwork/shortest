import pc from "picocolors";
import { LOG_LEVELS, LogFormat } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";

/**
 * Internal class for log output formatting and rendering.
 *
 * @class
 * @example
 * ```typescript
 * const event = new LogEvent("info", "Server started", { port: 3000 });
 * LogOutput.render(event, "terminal");
 * // info | 2024-03-20T10:30:00.000Z | Server started | port=3000
 * ```
 *
 * @internal Used by {@link Log.outputEvent}
 * @see {@link LogEvent} for event structure
 * @see {@link LogGroup} for grouping
 * @see {@link LogFormat} for formats
 *
 * @private
 */
export class LogOutput {
  private static readonly MAX_LEVEL_LENGTH = Math.max(
    ...LOG_LEVELS.map((level) => level.length),
  );

  private static readonly FILTERED_KEYS = ["apiKey"];

  /**
   * Renders a log event
   *
   * @param {LogEvent} event - Event to render
   * @param {LogFormat} format - Output format
   * @param {LogGroup} [group] - Optional group
   * @throws {Error} If format is unsupported
   */
  static render(
    event: LogEvent,
    format: LogFormat,
    group?: LogGroup,
  ): void | boolean {
    let output = "";

    const CONSOLE_METHODS = {
      trace: "log",
      debug: "debug",
      info: "info",
      warn: "warn",
      error: "error",
      silent: "log",
    } as const;

    const consoleMethod = CONSOLE_METHODS[event.level] || "log";

    switch (format) {
      case "terminal":
        output = LogOutput.renderForTerminal(event, group);
        return console[consoleMethod](output);
      case "reporter":
        output = LogOutput.renderForReporter(event, group);
        return process.stdout.write(`${output}\n`);
      default:
        throw new Error(`Unsupported log format: ${format}`);
    }
  }

  private static parseAndFilterMetadata(
    metadata: Record<string, any>,
  ): Record<string, any> {
    return Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => {
        if (LogOutput.FILTERED_KEYS.includes(k)) {
          return [k, "[FILTERED]"];
        }

        if (typeof v === "object" && v !== null) {
          const stringified = JSON.stringify(
            Object.fromEntries(
              Object.entries(v).map(([k2, v2]) => {
                if (LogOutput.FILTERED_KEYS.includes(k2)) {
                  return [k2, "[FILTERED]"];
                }
                return [k2, v2];
              }),
            ),
            null,
            2,
          );
          return [k, stringified];
        }

        // Format string values with newlines
        if (typeof v === "string" && v.includes("\n")) {
          return [k, "\n  " + v.split("\n").join("\n  ")];
        }

        return [k, JSON.stringify(v)];
      }),
    );
  }

  private static renderForReporter(event: LogEvent, group?: LogGroup): string {
    const INDENTATION_CHARACTER = "  ";
    const { message } = event;
    const groupIdentifiers = group ? group.getGroupIdentifiers() : [];

    let outputParts = [];
    if (groupIdentifiers.length > 0) {
      outputParts.push(INDENTATION_CHARACTER.repeat(groupIdentifiers.length));
    }
    outputParts.push(message);
    return outputParts.join("");
  }

  private static renderForTerminal(event: LogEvent, group?: LogGroup): string {
    const { level, timestamp, metadata } = event;
    let { message } = event;
    const groupIdentifiers = group ? group.getGroupIdentifiers() : [];
    let colorFn = pc.white;

    switch (level) {
      case "error":
        colorFn = pc.red;
        break;
      case "warn":
        colorFn = pc.yellow;
        break;
      case "info":
        colorFn = pc.cyan;
        break;
      case "debug":
        colorFn = pc.green;
        break;
      case "trace":
        colorFn = pc.gray;
        break;
    }

    const metadataStr = LogOutput.getMetadataString(metadata);
    if (event.level === "error") {
      message = pc.red(message);
    }

    let outputParts = [];
    outputParts.push(colorFn(`${level}`.padEnd(LogOutput.MAX_LEVEL_LENGTH)));
    outputParts.push(timestamp);
    outputParts.push(...groupIdentifiers.map((name) => pc.dim(name)));
    outputParts.push(message);
    if (metadataStr) {
      outputParts.push(metadataStr);
    }

    const output = outputParts.join(" | ");
    if (event.level === "warn") {
      return pc.yellowBright(output);
    }
    return output;
  }

  private static getMetadataString(
    metadata: Record<string, any>,
  ): string | undefined {
    const parsedMetadata = LogOutput.parseAndFilterMetadata(metadata);
    return metadata
      ? Object.entries(parsedMetadata)
          .map(([k, v]) => `${pc.dim(k)}=${v}`)
          .join(" ")
      : undefined;
  }
}
