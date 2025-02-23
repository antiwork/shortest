import { z, ZodError } from "zod";

export class ShortestError extends Error {
  type?: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// eslint-disable-next-line zod/require-zod-schema-types
const ConfigErrorTypeSchema = z.enum([
  "duplicate-config",
  "file-not-found",
  "invalid-config",
  "no-config",
]);
export type ConfigErrorType = z.infer<typeof ConfigErrorTypeSchema>;

export class ConfigError extends ShortestError {
  type: ConfigErrorType;

  constructor(type: ConfigErrorType, message: string) {
    super(message);
    this.type = ConfigErrorTypeSchema.parse(type);
  }
}

// eslint-disable-next-line zod/require-zod-schema-types
const AIErrorTypeSchema = z.enum([
  "invalid-response",
  "max-retries-reached",
  "token-limit-exceeded",
  "unsafe-content-detected",
  "unsupported-provider",
  "unknown",
]);
export type AIErrorType = z.infer<typeof AIErrorTypeSchema>;

export class AIError extends ShortestError {
  type: AIErrorType;

  constructor(type: AIErrorType, message: string) {
    super(message);
    this.type = AIErrorTypeSchema.parse(type);
  }
}

const CacheErrorTypeSchema = z.enum(["not-found", "invalid"]);
export type CacheErrorType = z.infer<typeof CacheErrorTypeSchema>;

export class CacheError extends ShortestError {
  type: CacheErrorType;

  constructor(type: CacheErrorType, message: string) {
    super(message);
    this.type = CacheErrorTypeSchema.parse(type);
  }
}

export const getErrorDetails = (error: any) => ({
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : "Unknown",
  type: error instanceof ShortestError ? error.type : undefined,
  stack:
    error instanceof Error
      ? error.stack?.split("\n").slice(1, 4).join("\n")
      : undefined,
});

export const formatZodError = <T>(
  error: ZodError<T>,
  label: string,
): string => {
  const errorsString = error.errors
    .map((err) => {
      const path = err.path.join(".");
      const prefix = path ? `${path}: ` : "";
      return `${prefix}${err.message}`;
    })
    .join("\n");

  return `${label}\n${errorsString}`;
};
