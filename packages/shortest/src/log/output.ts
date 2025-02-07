import pc from "picocolors";
import { LOG_LEVELS, LogFormat } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";

export class LogOutput {
  private static readonly MAX_LEVEL_LENGTH = Math.max(
    ...LOG_LEVELS.map((level) => level.length),
  );

  private static readonly FILTERED_KEYS = ["apiKey"];

  static render(event: LogEvent, format: LogFormat, group?: LogGroup): string {
    let output = "";
    switch (format) {
      case "pretty":
        output = LogOutput.renderForPretty(event, group);
        break;
      case "terminal":
        output = LogOutput.renderForTerminal(event, group);
        break;
      default:
        throw new Error(`Unsupported log format: ${format}`);
    }
    console.log(output);
    // switch (event.level) {
    //   case "error":
    //     console.error(output);
    //     break;
    //   case "warn":
    //     console.warn(output);
    //     break;
    //   case "info":
    //     console.log(output);
    //     break;
    //   case "debug":
    //     console.debug(output);
    //     break;
    //   case "trace":
    //     console.log(output);
    //     break;
    //   default:
    //     console.log(output);
    // }
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

  private static renderForPretty(event: LogEvent, group?: LogGroup): string {
    const INDENTATION_CHARACTER = " ";

    const { level, message, metadata } = event;
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

    let outputParts = [];
    if (groupIdentifiers.length > 0) {
      outputParts.push(
        INDENTATION_CHARACTER.repeat(groupIdentifiers.length - 1),
      );
    }
    if (level == "trace") {
      outputParts.push(colorFn(message));
    } else {
      outputParts.push(message);
    }
    if (metadataStr) {
      outputParts.push(" ", metadataStr);
    }

    return outputParts.join("");
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

    const metadataStr = LogOutput.getMetadataString(metadata);

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
