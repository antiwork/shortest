import { LogEvent } from "./event";
import { Log } from "./log";

export class LogGroup {
  private log: Log;
  readonly parent?: LogGroup;
  readonly name: string;
  readonly event: LogEvent;

  constructor(log: Log, name: string, parent?: LogGroup) {
    this.log = log;
    this.name = name;
    this.parent = parent;
    this.event = new LogEvent("trace", name);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log.log("info", message, metadata);
    return this;
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log.log("warn", message, metadata);
    return this;
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log.log("error", message, metadata);
    return this;
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.log.log("debug", message, metadata);
    return this;
  }

  trace(message: string, metadata?: Record<string, any>) {
    this.log.log("trace", message, metadata);
    return this;
  }

  getGroupIdentifiers(): string[] {
    const identifiers: string[] = [];
    let current: LogGroup | undefined = this;
    while (current) {
      identifiers.unshift(current.name);
      current = current.parent;
    }
    return identifiers;
  }
}
