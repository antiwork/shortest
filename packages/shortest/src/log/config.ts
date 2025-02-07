import { z } from "zod";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_FORMATS = ["terminal", "pretty"] as const;
export type LogFormat = (typeof LOG_FORMATS)[number];

export const LogConfigSchema = z.object({
  level: z.enum(LOG_LEVELS).default("info"),
  format: z.enum(LOG_FORMATS).default("pretty"),
  enabled: z.boolean().default(false),
});

export type LogConfig = z.infer<typeof LogConfigSchema>;
