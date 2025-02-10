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

export type LLMErrorType =
  | "invalid-response"
  | "token-limit-exceeded"
  | "unsafe-content-detected"
  | "unknown";
export class LLMError extends Error {
  type: LLMErrorType;

  constructor(type: LLMErrorType, message: string) {
    super(message);
    this.name = "LLMError";
    this.type = type;
  }
}

export type CacheErrorType =
  | "file-system"
  | "file-lock"
  | "crud"
  | "stale"
  | "unknown";
export class CacheError extends Error {
  type: CacheErrorType;

  constructor(type: CacheErrorType, message: string) {
    super(message);
    this.name = "CacheError";
    this.type = type;
  }
}
