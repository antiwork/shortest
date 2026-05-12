import type { TokenUsage } from "@/types/ai";
import type { CacheStep } from "@/types/cache";

export interface FailureReportOptions {
  enabled: boolean;
  outputDir: string;
  cwd?: string;
}

export interface ScreenshotAttachment {
  fileName: string;
  markdownPath: string;
}

export interface FailureReportInput {
  runId: string;
  testName: string;
  filePath: string;
  reason?: string;
  tokenUsage?: TokenUsage;
  steps: CacheStep[];
  screenshotSourceDir?: string;
  screenshots?: ScreenshotAttachment[];
}

// eslint-disable-next-line zod/require-zod-schema-types
export type RedactionKind =
  | "authorization"
  | "base64-image"
  | "cookie"
  | "high-entropy"
  | "password"
  | "secret-key"
  | "token"
  | "totp"
  | "typed-text"
  | "url-query";

export interface RedactionSummary
  extends Partial<Record<RedactionKind, number>> {}

export interface Redacted<T> {
  value: T;
  summary: RedactionSummary;
}
