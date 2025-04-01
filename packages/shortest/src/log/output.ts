import { Writable } from "node:stream";
import pc from "picocolors";
import { LogFormat, LOG_LEVELS } from "@/log/config";
import { LogEvent } from "@/log/event";
import { LogGroup } from "@/log/group";
import { ConfigError } from "@/utils/errors";

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
    outputStream: Writable,
    group?: LogGroup,
  ): void | boolean {
    let output = "";

    switch (format) {
      case "terminal":
        output = LogOutput.renderForTerminal(event, group);
        break;
      case "reporter":
        output = LogOutput.renderForReporter(event, group);
        break;
      default:
        throw new ConfigError(
          "invalid-config",
          `Unsupported log format: ${format}`,
        );
    }

    let stream = outputStream;
    if (outputStream === process.stdout) {
      if (event.level === "error" || event.level === "warn") {
        stream = process.stderr;
      }
    }
    stream.write(`${output}\n`);
  }

  private static renderForReporter(event: LogEvent, group?: LogGroup): string {
    const INDENTATION_CHARACTER = "  ";
    const { message } = event;
    const groupIdentifiers = group ? group.getGroupIdentifiers() : [];

    const outputParts = [];
    if (groupIdentifiers.length > 0) {
      outputParts.push(INDENTATION_CHARACTER.repeat(groupIdentifiers.length));
    }
    outputParts.push(message);
    return outputParts.join("");
  }

  private static renderForTerminal(event: LogEvent, group?: LogGroup): string {
    const { level, timestamp, parsedMetadata } = event;
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

    if (event.level === "error") {
      message = pc.red(message);
    }

    const outputParts = [];
    outputParts.push(colorFn(`${level}`.padEnd(LogOutput.MAX_LEVEL_LENGTH)));
    outputParts.push(
      timestamp.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
    outputParts.push(...groupIdentifiers.map((name) => pc.dim(name)));
    outputParts.push(message);
    if (parsedMetadata) {
      // Format metadata as "key=value" pairs, handling strings, null values, and nested objects
      const formattedMetadata =
        typeof parsedMetadata === "string"
          ? parsedMetadata
          : Object.entries(parsedMetadata)
              .map(([k, v]) => {
                const value =
                  typeof v === "string"
                    ? v.replace(/\\"/g, '"').replace(/\\n/g, "\n")
                    : v === null || v === undefined
                      ? "null"
                      : JSON.stringify(v, null, 2).replace(/\\n/g, "\n");
                return `${pc.dim(k)}=${value}${
                  typeof value === "string" && value.includes("\n") ? "\n" : ""
                }`;
              })
              .join(" ");
      outputParts.push(formattedMetadata);
    }

    const output = outputParts.join(" | ");
    if (event.level === "warn") {
      return pc.yellowBright(output);
    }
    return output;
  }
}
