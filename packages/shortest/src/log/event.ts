// import crypto from "crypto";
import { LogLevel } from "./config";

export class LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any> = {};

  constructor(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.message = message;
    this.metadata = metadata ?? {};
  }

  toJSON(): Record<string, any> {
    return {
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      metadata: this.metadata,
    };
  }
}
