import { LOG_LEVELS, LogLevel, LogConfig, LogConfigSchema } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";
import { LogOutput } from "./output";

export class Log {
  private config: LogConfig;
  private events: LogEvent[] = [];

  constructor(config: Partial<LogConfig> = {}) {
    this.config = LogConfigSchema.parse(config);
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVELS.indexOf(level) >=
      LOG_LEVELS.indexOf(this.config.level as LogLevel)
    );
  }

  private outputEvent(event: LogEvent): void {
    if (!this.shouldLog(event.level)) return;
    console.log(LogOutput.format(event, this.config.output));
  }

  log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    parent?: LogEvent,
  ) {
    const event = new LogEvent(level, message, metadata, parent);
    this.events.push(event);
    this.outputEvent(event);
  }

  trace(message: string, metadata?: Record<string, any>) {
    this.log("trace", message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log("error", message, metadata);
  }

  group(name: string): LogGroup {
    return new LogGroup(this, name);
  }

  setOutput(output: "terminal" | "ci" | "json"): void {
    this.config.output = output;
  }
}
