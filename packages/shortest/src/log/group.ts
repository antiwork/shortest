import { LogEvent } from "./event";
import { Log } from "./log";

export class LogGroup {
  private parentEvent: LogEvent;
  private log: Log;

  constructor(log: Log, name: string) {
    this.log = log;
    this.parentEvent = new LogEvent("info", `Group: ${name}`);
    this.log.log("info", `Start: ${name}`);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log.log("info", message, metadata, this.parentEvent);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log.log("warn", message, metadata, this.parentEvent);
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log.log("error", message, metadata, this.parentEvent);
  }

  end() {
    this.log.info(`End: ${this.parentEvent.message}`);
  }
}
