import { LogLevel } from "./interfaces";

export const EMOJIS = {
  warning: "⚠",
};

export const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
