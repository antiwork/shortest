import { LOG_LEVELS, LogLevel, LogConfig, LogConfigSchema } from "./config";
import { LogEvent } from "./event";
import { LogGroup } from "./group";
import { LogOutput } from "./output";

export class Log {
  readonly config: LogConfig;
  // private events: LogEvent[] = [];
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
    if (!this.shouldLog(event.level)) return;
    LogOutput.render(event, this.config.format, this.currentGroup);
  }

  log(level: LogLevel, ...args: any[]) {
    const metadata =
      args[args.length - 1]?.constructor === Object ? args.pop() : undefined;
    const message = args.join(" ");
    const event = new LogEvent(level, message, metadata);
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

  trace(...args: any[]) {
    this.log("trace", ...args);
  }

  debug(...args: any[]) {
    this.log("debug", ...args);
  }

  info(...args: any[]) {
    this.log("info", ...args);
  }

  warn(...args: any[]) {
    this.log("warn", ...args);
  }

  error(...args: any[]) {
    this.log("error", ...args);
  }
}
