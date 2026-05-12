import type { Redacted, RedactionKind, RedactionSummary } from "./types";

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|authorization|auth|cookie|session|otp|totp|base64[_-]?image|typed[_-]?text)/i;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const HIGH_ENTROPY_PATTERN =
  /\b(?=[A-Za-z0-9+/_.=-]{48,}\b)(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9+/_.=-]+\b/g;

const SECRET_PATTERNS: Array<{ kind: RedactionKind; pattern: RegExp }> = [
  {
    kind: "base64-image",
    pattern: /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,
  },
  { kind: "secret-key", pattern: /sk-ant-[A-Za-z0-9_-]+/g },
  { kind: "secret-key", pattern: /sk-proj-[A-Za-z0-9_-]+/g },
  { kind: "secret-key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { kind: "token", pattern: /\bghp_[A-Za-z0-9_]{20,}\b/g },
  { kind: "token", pattern: /\bgithub_pat_[A-Za-z0-9_]+\b/g },
  { kind: "authorization", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi },
  {
    kind: "token",
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  },
  {
    kind: "password",
    pattern: /\b(pass(?:word|wd))\s*[:=]\s*["']?[^"',\s)]+/gi,
  },
];

export const mergeRedactionSummaries = (
  ...summaries: RedactionSummary[]
): RedactionSummary =>
  summaries.reduce<RedactionSummary>((merged, summary) => {
    for (const [kind, count] of Object.entries(summary)) {
      if (!count) continue;

      const redactionKind = kind as RedactionKind;
      merged[redactionKind] = (merged[redactionKind] ?? 0) + count;
    }

    return merged;
  }, {});

const increment = (summary: RedactionSummary, kind: RedactionKind): void => {
  summary[kind] = (summary[kind] ?? 0) + 1;
};

const getSensitiveKeyKind = (keyHint?: string): RedactionKind | null => {
  if (!keyHint || !SENSITIVE_KEY_PATTERN.test(keyHint)) return null;

  if (/base64[_-]?image/i.test(keyHint)) return "base64-image";
  if (/typed[_-]?text/i.test(keyHint)) return "typed-text";
  if (/password|passwd/i.test(keyHint)) return "password";
  if (/otp|totp/i.test(keyHint)) return "totp";
  if (/cookie|session/i.test(keyHint)) return "cookie";
  if (/authorization|auth/i.test(keyHint)) return "authorization";
  if (/secret|api[_-]?key/i.test(keyHint)) return "secret-key";

  return "token";
};

export const redactUrl = (value: string): Redacted<string> => {
  const summary: RedactionSummary = {};
  const redacted = value.replace(URL_PATTERN, (match) => {
    try {
      const url = new URL(match);
      if (!url.search && !url.hash) return match;

      url.search = "";
      url.hash = "";
      increment(summary, "url-query");

      return `${url.toString()}?[redacted]`;
    } catch {
      return match;
    }
  });

  return { value: redacted, summary };
};

export const redactString = (
  value: string,
  keyHint?: string,
): Redacted<string> => {
  const sensitiveKeyKind = getSensitiveKeyKind(keyHint);
  if (sensitiveKeyKind) {
    return {
      value: `[REDACTED:${sensitiveKeyKind}]`,
      summary: { [sensitiveKeyKind]: 1 },
    };
  }

  let redacted = value;
  let summary: RedactionSummary = {};

  const urlRedaction = redactUrl(redacted);
  redacted = urlRedaction.value;
  summary = mergeRedactionSummaries(summary, urlRedaction.summary);

  for (const { kind, pattern } of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      increment(summary, kind);

      if (kind === "password") {
        const label = match.split(/[:=]/)[0].trim();
        return `${label}: [REDACTED:password]`;
      }

      return `[REDACTED:${kind}]`;
    });
  }

  redacted = redacted.replace(HIGH_ENTROPY_PATTERN, () => {
    increment(summary, "high-entropy");
    return "[REDACTED:high-entropy]";
  });

  return { value: redacted, summary };
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const redactKnownLiterals = (
  value: string,
  literals: Array<{ value: string; kind: RedactionKind }>,
): Redacted<string> => {
  let redacted = value;
  const summary: RedactionSummary = {};
  const seen = new Set<string>();
  const uniqueLiterals = literals
    .map(({ value, kind }) => ({ value: value.trim(), kind }))
    .filter(({ value }) => value.length >= 3)
    .filter(({ value, kind }) => {
      const key = `${kind}:${value}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .sort((a, b) => b.value.length - a.value.length);

  for (const literal of uniqueLiterals) {
    const pattern = new RegExp(escapeRegExp(literal.value), "g");
    redacted = redacted.replace(pattern, () => {
      increment(summary, literal.kind);

      return `[REDACTED:${literal.kind}]`;
    });
  }

  return { value: redacted, summary };
};

export const redactValue = <T>(value: T, keyHint?: string): Redacted<T> => {
  if (typeof value === "string") {
    return redactString(value, keyHint) as Redacted<T>;
  }

  const sensitiveKeyKind = getSensitiveKeyKind(keyHint);
  if (sensitiveKeyKind) {
    return {
      value: `[REDACTED:${sensitiveKeyKind}]` as T,
      summary: { [sensitiveKeyKind]: 1 },
    };
  }

  if (Array.isArray(value)) {
    const redactedItems: unknown[] = [];
    let summary: RedactionSummary = {};

    for (const item of value) {
      const redacted = redactValue(item);
      redactedItems.push(redacted.value);
      summary = mergeRedactionSummaries(summary, redacted.summary);
    }

    return { value: redactedItems as T, summary };
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    let summary: RedactionSummary = {};

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const redacted = redactValue(child, key);
      output[key] = redacted.value;
      summary = mergeRedactionSummaries(summary, redacted.summary);
    }

    return { value: output as T, summary };
  }

  return { value, summary: {} };
};
