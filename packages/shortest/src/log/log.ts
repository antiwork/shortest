import { LOG_LEVELS, LogLevel, LogConfig, LogConfigSchema } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";
import { LogOutput } from "./output";

export class Log {
  private config: LogConfig;
  private events: LogEvent[] = [];
  private currentGroup?: LogGroup;

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
    if (!this.config.enabled) return;
    if (!this.shouldLog(event.level)) return;
    console.log(LogOutput.render(event, this.config.output, this.currentGroup));
  }

  log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const event = new LogEvent(level, message, metadata);
    this.events.push(event);
    this.outputEvent(event);
  }

  setGroup(name: string): void {
    this.log("trace", `Setting group: ${name}`);
    this.currentGroup = new LogGroup(this, name, this.currentGroup);
  }

  resetGroup(): void {
    this.log("trace", "Resetting group");
    this.currentGroup = this.currentGroup?.parent;
  }

  resetAllGroups(): void {
    this.log("trace", "Resetting all groups");
    this.currentGroup = undefined;
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

  setOutput(output: "terminal" | "ci" | "json"): void {
    this.config.output = output;
  }
}
