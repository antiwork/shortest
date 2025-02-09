import { z } from "zod";

/**
 * Log configuration types and schema.
 *
 * @example
 * ```typescript
 * const config: LogConfig = {
 *   level: "debug",
 *   format: "terminal"
 * };
 * ```
 *
 * @see {@link Log} for usage
 */
export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "silent",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_FORMATS = ["terminal", "pretty", "reporter"] as const;
export type LogFormat = (typeof LOG_FORMATS)[number];

export const LogConfigSchema = z.object({
  level: z.enum(LOG_LEVELS).default("silent"),
  format: z.enum(LOG_FORMATS).default("terminal"),
});

export type LogConfig = z.infer<typeof LogConfigSchema>;
