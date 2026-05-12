import { describe, expect, it } from "vitest";
import {
  redactKnownLiterals,
  redactString,
  redactUrl,
  redactValue,
} from "./redact";

describe("redactString", () => {
  it("redacts Anthropic and OpenAI style API keys", () => {
    const result = redactString(
      "anthropic=sk-ant-api03-abcdefghijklmnopqrstuvwxyz openai=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    );

    expect(result.value).not.toContain("sk-ant-api03");
    expect(result.value).not.toContain("sk-proj");
    expect(result.summary["secret-key"]).toBe(2);
  });

  it("redacts GitHub personal access tokens", () => {
    const result = redactString(
      "token ghp_abcdefghijklmnopqrstuvwxyz1234567890 and github_pat_11AAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    );

    expect(result.value).not.toContain("ghp_");
    expect(result.value).not.toContain("github_pat_");
    expect(result.summary.token).toBe(2);
  });

  it("redacts bearer tokens and JWT-like values", () => {
    const result = redactString(
      "Authorization: Bearer abc.def.ghi jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature_value",
    );

    expect(result.value).not.toContain("Bearer abc.def.ghi");
    expect(result.value).not.toContain("eyJhbGci");
    expect(result.summary.authorization).toBe(1);
    expect(result.summary.token).toBe(1);
  });

  it("redacts URL query strings and hashes", () => {
    const result = redactUrl(
      "Open https://example.com/login?token=abc#secret now",
    );

    expect(result.value).toBe("Open https://example.com/login?[redacted] now");
    expect(result.summary["url-query"]).toBe(1);
  });

  it("redacts base64 image data", () => {
    const result = redactString(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    );

    expect(result.value).toBe("[REDACTED:base64-image]");
    expect(result.summary["base64-image"]).toBe(1);
  });

  it("redacts password assignments in free text", () => {
    const result = redactString("Login failed with password=hunter2");

    expect(result.value).toBe(
      "Login failed with password: [REDACTED:password]",
    );
    expect(result.summary.password).toBe(1);
  });

  it("preserves safe strings", () => {
    const result = redactString("Clicked the submit button");

    expect(result.value).toBe("Clicked the submit button");
    expect(result.summary).toEqual({});
  });
});

describe("redactKnownLiterals", () => {
  it("redacts collected sensitive literals in surrounding text", () => {
    const result = redactKnownLiterals(
      "The login failed after typing hunter2 into the form",
      [{ value: "hunter2", kind: "typed-text" }],
    );

    expect(result.value).toBe(
      "The login failed after typing [REDACTED:typed-text] into the form",
    );
    expect(result.summary["typed-text"]).toBe(1);
  });

  it("ignores tiny literals to avoid noisy over-redaction", () => {
    const result = redactKnownLiterals("Tap a button", [
      { value: "a", kind: "typed-text" },
    ]);

    expect(result.value).toBe("Tap a button");
    expect(result.summary).toEqual({});
  });
});

describe("redactValue", () => {
  it("redacts nested sensitive fields without mutating the original object", () => {
    const original = {
      payload: {
        username: "sushi",
        password: "hunter2",
        headers: {
          Authorization: "Bearer abc.def.ghi",
          Cookie: "sid=secret",
        },
      },
    };

    const result = redactValue(original);

    expect(result.value.payload.username).toBe("sushi");
    expect(result.value.payload.password).toBe("[REDACTED:password]");
    expect(result.value.payload.headers.Authorization).toBe(
      "[REDACTED:authorization]",
    );
    expect(result.value.payload.headers.Cookie).toBe("[REDACTED:cookie]");
    expect(result.summary.password).toBe(1);
    expect(result.summary.authorization).toBe(1);
    expect(result.summary.cookie).toBe(1);
    expect(original.payload.password).toBe("hunter2");
  });

  it("redacts whole nested values under sensitive keys", () => {
    const result = redactValue({
      auth: {
        scheme: "Bearer",
        value: "abc.def.ghi",
      },
      cookies: [{ name: "sid", value: "secret" }],
    });

    expect(result.value.auth).toBe("[REDACTED:authorization]");
    expect(result.value.cookies).toBe("[REDACTED:cookie]");
    expect(result.summary.authorization).toBe(1);
    expect(result.summary.cookie).toBe(1);
  });

  it("redacts TOTP, API key, token, session, and base64 image keys", () => {
    const result = redactValue({
      totpSecret: "JBSWY3DPEHPK3PXP",
      api_key: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      sessionToken: "abc123",
      base64_image: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
    });

    expect(result.value.totpSecret).toBe("[REDACTED:totp]");
    expect(result.value.api_key).toBe("[REDACTED:secret-key]");
    expect(result.value.sessionToken).toBe("[REDACTED:cookie]");
    expect(result.value.base64_image).toBe("[REDACTED:base64-image]");
  });

  it("redacts typed text when explicitly hinted", () => {
    const result = redactString("hunter2", "typed-text");

    expect(result.value).toBe("[REDACTED:typed-text]");
    expect(result.summary["typed-text"]).toBe(1);
  });

  it("redacts nested arrays and high entropy strings", () => {
    const result = redactValue({
      values: [
        "safe",
        "aZ9x".repeat(16),
        { url: "https://example.com/path?secret=yes" },
      ],
    });

    expect(result.value.values[0]).toBe("safe");
    expect(result.value.values[1]).toBe("[REDACTED:high-entropy]");
    expect(result.value.values[2]).toEqual({
      url: "https://example.com/path?[redacted]",
    });
    expect(result.summary["high-entropy"]).toBe(1);
    expect(result.summary["url-query"]).toBe(1);
  });
});
