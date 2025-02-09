import pc from "picocolors";
import { LOG_LEVELS, LogFormat } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";

export class LogOutput {
  private static readonly MAX_LEVEL_LENGTH = Math.max(
    ...LOG_LEVELS.map((level) => level.length),
  );

  private static readonly FILTERED_KEYS = ["apiKey"];

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
      // case "pretty":
      //   output = LogOutput.renderForPretty(event, group);
      //   return console[consoleMethod](output);
      case "terminal":
        output = LogOutput.renderForTerminal(event, group);
        if (event.level === "warn") {
          output = pc.yellowBright(output);
        }
        return console[consoleMethod](output);
      case "reporter":
        return process.stdout.write(`${event.message}\n`);
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

  // private static renderForPretty(event: LogEvent, group?: LogGroup): string {
  //   const INDENTATION_CHARACTER = " ";

  //   const { level, message, metadata } = event;
  //   const groupIdentifiers = group ? group.getGroupIdentifiers() : [];
  //   let colorFn = pc.white;

  //   switch (level) {
  //     case "error":
  //       colorFn = pc.red;
  //       break;
  //     case "warn":
  //       colorFn = pc.yellow;
  //       break;
  //     case "info":
  //       colorFn = pc.cyan;
  //       break;
  //     case "debug":
  //       colorFn = pc.green;
  //       break;
  //     case "trace":
  //       colorFn = pc.gray;
  //       break;
  //   }

  //   const metadataStr = LogOutput.getMetadataString(metadata);

  //   let outputParts = [];
  //   if (groupIdentifiers.length > 0) {
  //     outputParts.push(
  //       INDENTATION_CHARACTER.repeat(groupIdentifiers.length - 1),
  //     );
  //   }
  //   if (level == "trace") {
  //     outputParts.push(colorFn(message));
  //   } else {
  //     outputParts.push(message);
  //   }
  //   if (metadataStr) {
  //     outputParts.push(" ", metadataStr);
  //   }

  //   return outputParts.join("");
  // }

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
