import pc from "picocolors";
import { z, ZodError } from "zod";

export class ShortestError extends Error {
  type?: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

const ConfigErrorTypeSchema = z.enum([
  "duplicate-config",
  "file-not-found",
  "invalid-config",
  "multiple-config",
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
export class ToolError extends ShortestError {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

const TestErrorTypeSchema = z.enum([
  "callback-execution-failed",
  "assertion-failed",
]);
export type TestErrorType = z.infer<typeof TestErrorTypeSchema>;

export class TestError extends ShortestError {
  type: TestErrorType;
  actual?: any;
  expected?: any;

  constructor(
    type: TestErrorType,
    message: string,
    options?: { actual?: any; expected?: any },
  ) {
    super(message);
    this.type = TestErrorTypeSchema.parse(type);
    this.actual = options?.actual;
    this.expected = options?.expected;
  }
}

export const getErrorDetails = (error: any) => {
  const metadata = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
    type: error instanceof ShortestError ? error.type : undefined,
    stack:
      error instanceof Error
        ? error.stack?.split("\n").slice(1, 4).join("\n")
        : undefined,
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([_, value]) => value !== null && value !== undefined,
    ),
  );
};

export const formatZodError = <T>(
  error: ZodError<T>,
  label: string,
): string => {
  const errorsString = error.errors
    .map((err) => {
      const path = err.path.join(".");
      const prefix = path ? `${pc.cyan(path)}: ` : "";
      const receivedInfo =
        "received" in err ? ` (received: ${JSON.stringify(err.received)})` : "";

      if (
        err.code === "invalid_union_discriminator" ||
        err.code === "invalid_enum_value"
      ) {
        err.message = err.message.replace(
          /Invalid (discriminator|enum) value/,
          "Invalid value",
        );
      }
      return `${prefix}${err.message}${receivedInfo}`;
    })
    .join("\n");

  return `${label}\n${errorsString}`;
};

export const asShortestError = (error: any) =>
  error instanceof Error
    ? Object.assign(new ShortestError(error.message), error, {
        name: "ShortestError",
      })
    : new ShortestError(String(error));
