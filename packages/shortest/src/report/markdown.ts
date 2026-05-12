import {
  mergeRedactionSummaries,
  redactKnownLiterals,
  redactString,
  redactValue,
} from "./redact";
import type {
  FailureReportInput,
  RedactionKind,
  RedactionSummary,
  ScreenshotAttachment,
} from "./types";
import { InternalActionEnum } from "@/types/browser";
import type { CacheAction, CacheStep } from "@/types/cache";

const MAX_STEPS = 10;
const MAX_EMBEDDED_SCREENSHOTS = 5;
const MAX_INLINE_LENGTH = 300;
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const SENSITIVE_LITERAL_KEY_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|authorization|auth|cookie|session|otp|totp|base64[_-]?image|typed[_-]?text)/i;

const formatNumber = (value: number | undefined): string =>
  value === undefined ? "0" : NUMBER_FORMATTER.format(value);

const truncate = (value: string, maxLength = MAX_INLINE_LENGTH): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;

const normalizeInline = (value: string): string =>
  truncate(
    value
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\s+/g, " ")
      .trim(),
  );

const normalizeBlock = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

const escapeMarkdownInline = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}()#+!|])/g, "\\$1");

const fencedCodeBlock = (value: string): string => {
  const normalized = normalizeBlock(value);
  const longestFence =
    normalized
      .match(/`{3,}/g)
      ?.reduce((max, fence) => Math.max(max, fence.length), 2) ?? 2;
  const fence = "`".repeat(longestFence + 1);

  return `${fence}txt\n${normalized}\n${fence}`;
};

const markdownLinkPath = (value: string): string =>
  value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const formatSummary = (summary: RedactionSummary): string => {
  const entries = Object.entries(summary).filter(([, count]) => count);
  if (entries.length === 0) return "- none";

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `- ${kind}: ${count}`)
    .join("\n");
};

const formatJson = (value: unknown): string => {
  try {
    return escapeMarkdownInline(normalizeInline(JSON.stringify(value)));
  } catch {
    return escapeMarkdownInline(normalizeInline(String(value)));
  }
};

const getActionName = (action: CacheAction): string =>
  action.input?.action ?? action.name ?? "tool";

const summarizeAction = (
  action: CacheAction | null,
): { text: string; summary: RedactionSummary } => {
  if (!action) return { text: "text", summary: {} };

  const actionName = getActionName(action);
  const input = action.input ?? {};

  if (
    actionName === InternalActionEnum.TYPE &&
    typeof input.text === "string"
  ) {
    const redacted = redactString(input.text, "typed-text");

    return {
      text: `${escapeMarkdownInline(actionName)} - Typed: ${escapeMarkdownInline(redacted.value)}`,
      summary: redacted.summary,
    };
  }

  if (
    actionName === InternalActionEnum.NAVIGATE &&
    typeof input.url === "string"
  ) {
    const redacted = redactString(input.url, "url");

    return {
      text: `${escapeMarkdownInline(actionName)} - URL: ${escapeMarkdownInline(normalizeInline(redacted.value))}`,
      summary: redacted.summary,
    };
  }

  const coordinate = input.coordinate ?? input.coordinates;
  if (Array.isArray(coordinate) && coordinate.length >= 2) {
    return {
      text: `${escapeMarkdownInline(actionName)} - Coordinate: (${escapeMarkdownInline(String(coordinate[0]))}, ${escapeMarkdownInline(String(coordinate[1]))})`,
      summary: {},
    };
  }

  const redactedInput = redactValue(input);
  const inputText =
    Object.keys(input).length > 0
      ? ` - Input: ${formatJson(redactedInput.value)}`
      : "";

  return {
    text: `${escapeMarkdownInline(actionName)}${inputText}`,
    summary: redactedInput.summary,
  };
};

interface SensitiveLiteral {
  value: string;
  kind: RedactionKind;
}

const getSensitiveLiteralKind = (keyHint: string): RedactionKind | null => {
  if (!SENSITIVE_LITERAL_KEY_PATTERN.test(keyHint)) return null;

  if (/base64[_-]?image/i.test(keyHint)) return "base64-image";
  if (/typed[_-]?text/i.test(keyHint)) return "typed-text";
  if (/password|passwd/i.test(keyHint)) return "password";
  if (/otp|totp/i.test(keyHint)) return "totp";
  if (/cookie|session/i.test(keyHint)) return "cookie";
  if (/authorization|auth/i.test(keyHint)) return "authorization";
  if (/secret|api[_-]?key/i.test(keyHint)) return "secret-key";

  return "token";
};

const collectStringLeaves = (
  value: unknown,
  kind: RedactionKind,
): SensitiveLiteral[] => {
  if (typeof value === "string") return [{ value, kind }];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringLeaves(item, kind));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((child) =>
      collectStringLeaves(child, kind),
    );
  }

  return [];
};

const collectSensitiveLiteralsFromValue = (
  value: unknown,
  keyHint?: string,
): SensitiveLiteral[] => {
  const keyKind = keyHint ? getSensitiveLiteralKind(keyHint) : null;
  if (keyKind) return collectStringLeaves(value, keyKind);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSensitiveLiteralsFromValue(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectSensitiveLiteralsFromValue(child, key),
    );
  }

  return [];
};

const collectSensitiveLiterals = (steps: CacheStep[]): SensitiveLiteral[] =>
  steps.flatMap((step) => {
    const input = step.action?.input;
    if (!input) return [];

    const literals = collectSensitiveLiteralsFromValue(input);
    if (
      input.action === InternalActionEnum.TYPE &&
      typeof input.text === "string"
    ) {
      literals.push({ value: input.text, kind: "typed-text" });
    }

    return literals;
  });

const redactReportText = (
  value: string,
  literals: SensitiveLiteral[],
  keyHint?: string,
): RedactedString => {
  const redacted = redactString(value, keyHint);
  const literalRedaction = redactKnownLiterals(redacted.value, literals);

  return {
    value: literalRedaction.value,
    summary: mergeRedactionSummaries(
      redacted.summary,
      literalRedaction.summary,
    ),
  };
};

interface RedactedString {
  value: string;
  summary: RedactionSummary;
}

const renderStep = (
  step: CacheStep,
  index: number,
  sensitiveLiterals: SensitiveLiteral[],
): { lines: string[]; summary: RedactionSummary } => {
  const action = summarizeAction(step.action);
  const isTypedTextAction =
    step.action?.input?.action === InternalActionEnum.TYPE;
  const reasoning = redactReportText(step.reasoning ?? "", sensitiveLiterals);
  const result = redactReportText(
    step.result ?? "",
    sensitiveLiterals,
    isTypedTextAction ? "typed-text" : undefined,
  );
  const summary = mergeRedactionSummaries(
    action.summary,
    reasoning.summary,
    result.summary,
  );
  const lines = [`${index}. ${action.text}`];

  if (reasoning.value) {
    lines.push(
      `   - Reasoning: ${escapeMarkdownInline(normalizeInline(reasoning.value))}`,
    );
  }

  if (result.value) {
    lines.push(
      `   - Result: ${escapeMarkdownInline(normalizeInline(result.value))}`,
    );
  }

  return { lines, summary };
};

const renderScreenshots = (
  screenshots: ScreenshotAttachment[] = [],
): string[] => {
  if (screenshots.length === 0) return ["No screenshots recorded."];

  const embeddedScreenshots = screenshots.slice(-MAX_EMBEDDED_SCREENSHOTS);
  const lines = [
    "Screenshots are included for debugging and are not machine-redacted. Review them before sharing this report.",
    "",
    ...embeddedScreenshots.flatMap((screenshot, index) => [
      `![Screenshot ${index + 1}](${markdownLinkPath(screenshot.markdownPath)})`,
      "",
    ]),
    "All screenshots:",
    ...screenshots.map(
      (screenshot) =>
        `- [${escapeMarkdownInline(screenshot.fileName)}](${markdownLinkPath(screenshot.markdownPath)})`,
    ),
  ];

  return lines;
};

export const renderFailureReport = (input: FailureReportInput): string => {
  const sensitiveLiterals = collectSensitiveLiterals(input.steps);
  const testName = redactString(input.testName);
  const filePath = redactString(input.filePath);
  const runId = redactString(input.runId);
  const reason = redactReportText(
    input.reason ?? "No failure reason recorded",
    sensitiveLiterals,
  );
  const steps = input.steps.slice(-MAX_STEPS);
  let summary = mergeRedactionSummaries(
    testName.summary,
    filePath.summary,
    runId.summary,
    reason.summary,
  );

  const renderedSteps = steps.flatMap((step, index) => {
    const rendered = renderStep(step, index + 1, sensitiveLiterals);
    summary = mergeRedactionSummaries(summary, rendered.summary);

    return rendered.lines;
  });

  const stepIntro =
    input.steps.length > steps.length
      ? `Showing last ${steps.length} of ${input.steps.length} steps.`
      : `Showing ${steps.length} recorded step${steps.length === 1 ? "" : "s"}.`;

  return [
    "# Shortest failure report",
    "",
    "Generated by Shortest. Review text and screenshots before sharing.",
    "",
    "## Test",
    "",
    `- Name: ${escapeMarkdownInline(normalizeInline(testName.value))}`,
    `- File: ${escapeMarkdownInline(normalizeInline(filePath.value))}`,
    `- Run: ${escapeMarkdownInline(normalizeInline(runId.value))}`,
    "- Status: failed",
    "",
    "## Failure",
    "",
    fencedCodeBlock(reason.value),
    "",
    "## Token usage",
    "",
    `- Prompt: ${formatNumber(input.tokenUsage?.promptTokens)}`,
    `- Completion: ${formatNumber(input.tokenUsage?.completionTokens)}`,
    `- Total: ${formatNumber(input.tokenUsage?.totalTokens)}`,
    "",
    "## Last recorded steps",
    "",
    stepIntro,
    "",
    ...(renderedSteps.length ? renderedSteps : ["No steps recorded."]),
    "",
    "## Screenshots",
    "",
    ...renderScreenshots(input.screenshots),
    "",
    "## Redactions",
    "",
    formatSummary(summary),
    "",
    "## Notes",
    "",
    "This report intentionally omits raw base64 image data, cookies, auth headers, and full cache JSON. Screenshot files are attached separately and are not machine-redacted.",
    "",
  ].join("\n");
};
