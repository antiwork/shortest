import pc from "picocolors";
import { LOG_LEVELS } from "./config";
import { LogEvent } from "./event";

export class LogOutput {
  private static readonly MAX_LEVEL_LENGTH = Math.max(
    ...LOG_LEVELS.map((level) => level.length),
  );

  private static readonly FILTERED_KEYS = ["apiKey"];

  static format(
    event: LogEvent,
    outputType: "terminal" | "ci" | "json",
  ): string {
    switch (outputType) {
      case "json":
        return JSON.stringify(event.toJSON());
      case "ci":
        return `::${event.level}::${event.message}`;
      case "terminal":
      default:
        return LogOutput.formatForTerminal(event);
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
          );
          return [k, stringified];
        }
        return [k, JSON.stringify(v)];
      }),
    );
  }

  private static formatForTerminal(event: LogEvent): string {
    const { level, message, timestamp, metadata } = event;
    const parentEvents = event.parentEvents;
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

    const parsedMetadata = LogOutput.parseAndFilterMetadata(metadata);
    const metadataStr = metadata
      ? Object.entries(parsedMetadata)
          .map(([k, v]) => `${pc.dim(k)}=${v}`)
          .join(" ")
      : undefined;

    let outputParts = [];
    outputParts.push(colorFn(`${level}`.padEnd(LogOutput.MAX_LEVEL_LENGTH)));
    outputParts.push(timestamp);
    outputParts.push(...parentEvents.map((e) => pc.dim(e.message)));
    outputParts.push(message);
    if (metadataStr) {
      outputParts.push(metadataStr);
    }

    return outputParts.join(" | ");
  }
}
