import { LogLevel } from "./config";

export class LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any> = {};
  parent?: LogEvent;

  constructor(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    parent?: LogEvent,
  ) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.message = message;
    this.metadata = metadata ?? {};
    this.parent = parent;
  }

  toJSON(): Record<string, any> {
    return {
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      metadata: this.metadata,
      parent: this.parent?.message,
    };
  }
}
