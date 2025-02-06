import pc from "picocolors";
import { LOG_LEVELS } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";

export class LogOutput {
  private static readonly MAX_LEVEL_LENGTH = Math.max(
    ...LOG_LEVELS.map((level) => level.length),
  );

  private static readonly FILTERED_KEYS = ["apiKey"];

  static render(
    event: LogEvent,
    format: "terminal" | "ci" | "json",
    group?: LogGroup,
  ): string {
    switch (format) {
      case "json":
        return JSON.stringify(event.toJSON());
      case "ci":
        return `::${event.level}::${event.message}`;
      case "terminal":
      default:
        return LogOutput.renderForTerminal(event, group);
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

  private static renderForTerminal(event: LogEvent, group?: LogGroup): string {
    const { level, message, timestamp, metadata } = event;
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

    const parsedMetadata = LogOutput.parseAndFilterMetadata(metadata);
    const metadataStr = metadata
      ? Object.entries(parsedMetadata)
          .map(([k, v]) => `${pc.dim(k)}=${v}`)
          .join(" ")
      : undefined;

    let outputParts = [];
    outputParts.push(colorFn(`${level}`.padEnd(LogOutput.MAX_LEVEL_LENGTH)));
    outputParts.push(timestamp);
    outputParts.push(...groupIdentifiers.map((name) => pc.dim(name)));
    outputParts.push(message);
    if (metadataStr) {
      outputParts.push(metadataStr);
    }

    return outputParts.join(" | ");
  }
}
