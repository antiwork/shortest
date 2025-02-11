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

export function getErrorDetails(error: any) {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
    stack:
      error instanceof Error
        ? error.stack?.split("\n").slice(1, 4).join("\n")
        : undefined,
  };
}
