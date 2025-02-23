import { ZodError } from "zod";

// eslint-disable-next-line zod/require-zod-schema-types
export type ConfigErrorType =
  | "duplicate-config"
  | "file-not-found"
  | "invalid-config"
  | "no-config";
export class ConfigError extends Error {
  type: ConfigErrorType;

  constructor(type: ConfigErrorType, message: string) {
    super(message);
    this.name = "ConfigError";
    this.type = type;
  }
}

// eslint-disable-next-line zod/require-zod-schema-types
export type AIErrorType =
  | "invalid-response"
  | "max-retries-reached"
  | "token-limit-exceeded"
  | "unsafe-content-detected"
  | "unsupported-provider"
  | "unknown";

export class AIError extends Error {
  type: AIErrorType;

  constructor(type: AIErrorType, message: string) {
    super(message);
    this.name = "AIError";
    this.type = type;
  }
}

class ShortestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortestError";
  }
}

export class RunnerError extends ShortestError {
  constructor(message: string) {
    super(message);
    this.name = "RunnerError";
  }
}

export const getErrorDetails = (error: any) => ({
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : "Unknown",
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
