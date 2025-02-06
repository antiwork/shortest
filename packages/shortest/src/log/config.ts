import { z } from "zod";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
];

export const LogConfigSchema = z.object({
  level: z.enum(LOG_LEVELS as [string, ...string[]]).default("info"),
  output: z.enum(["terminal", "ci", "json"]).default("terminal"),
});

export type LogConfig = z.infer<typeof LogConfigSchema>;
