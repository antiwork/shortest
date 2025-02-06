import { LogEvent } from "./event";
import { Log } from "./log";

export class LogGroup {
  private parentEvent: LogEvent;
  private log: Log;

  constructor(log: Log, name: string, parent?: LogEvent) {
    this.log = log;
    const parentEvent = new LogEvent("info", name, undefined, parent);
    this.parentEvent = parentEvent;
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log.log("info", message, metadata, this.parentEvent);
    return this;
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log.log("warn", message, metadata, this.parentEvent);
    return this;
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log.log("error", message, metadata, this.parentEvent);
    return this;
  }

  group(name: string): LogGroup {
    const group = new LogGroup(this.log, name, this.parentEvent);
    return group;
  }
}
