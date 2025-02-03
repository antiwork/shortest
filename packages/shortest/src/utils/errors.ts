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
