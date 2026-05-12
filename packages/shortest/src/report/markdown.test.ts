import { describe, expect, it } from "vitest";
import { renderFailureReport } from "./markdown";
import type { FailureReportInput } from "./types";

const input: FailureReportInput = {
  runId: "2026-05-08T16-12-03-abc123",
  testName: "Login to the app",
  filePath: "app/login.test.ts",
  reason:
    "Failed with password=hunter2 and token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
  tokenUsage: {
    promptTokens: 1000,
    completionTokens: 250,
    totalTokens: 1250,
  },
  steps: [
    {
      reasoning: "Need to type the user password",
      action: {
        type: "tool_use",
        name: "type" as any,
        input: { action: "type", text: "hunter2" } as any,
      },
      timestamp: 1,
      result: "Typed: hunter2",
    },
  ],
  screenshots: [
    {
      fileName: "screenshot-1.png",
      markdownPath: "run/screenshots/screenshot-1.png",
    },
  ],
};

describe("renderFailureReport", () => {
  it("renders test metadata, failure reason, and token usage", () => {
    const report = renderFailureReport(input);

    expect(report).toContain("# Shortest failure report");
    expect(report).toContain("- Name: Login to the app");
    expect(report).toContain("- File: app/login.test.ts");
    expect(report).toContain("- Run: 2026-05-08T16-12-03-abc123");
    expect(report).toContain("- Prompt: 1,000");
    expect(report).toContain("- Completion: 250");
    expect(report).toContain("- Total: 1,250");
  });

  it("redacts sensitive failure and step text", () => {
    const report = renderFailureReport(input);

    expect(report).not.toContain("hunter2");
    expect(report).not.toContain("ghp_");
    expect(report).toContain("[REDACTED:password]");
    expect(report).toContain("[REDACTED:typed-text]");
    expect(report).toContain("typed-text:");
  });

  it("redacts typed text when repeated in reasoning and failure reason", () => {
    const report = renderFailureReport({
      ...input,
      reason: "The login failed after entering hunter2",
      steps: [
        {
          reasoning: "I will type hunter2 into the password field",
          action: {
            type: "tool_use",
            name: "type" as any,
            input: { action: "type", text: "hunter2" } as any,
          },
          timestamp: 1,
          result: "The field contains hunter2",
        },
      ],
    });

    expect(report).not.toContain("hunter2");
    expect(report).toContain("[REDACTED:typed-text]");
    expect(report).toContain("typed-text:");
  });

  it("redacts sensitive object values when repeated outside action input", () => {
    const report = renderFailureReport({
      ...input,
      reason: "The API returned a failure for magic-secret",
      steps: [
        {
          reasoning: "Send auth payload",
          action: {
            type: "tool_use",
            name: "navigate" as any,
            input: {
              action: "navigate",
              auth: { token: "magic-secret" },
            } as any,
          },
          timestamp: 1,
          result: "magic-secret was rejected",
        },
      ],
    });

    expect(report).not.toContain("magic-secret");
    expect(report).toContain("[REDACTED:authorization]");
  });

  it("escapes dynamic Markdown in failure and step text", () => {
    const report = renderFailureReport({
      ...input,
      reason: "Broken ![leak](https://example.com/?token=abc)",
      steps: [
        {
          reasoning: "See <img src=x> and [token](https://x.test/?a=b)",
          action: {
            type: "tool_use",
            name: "click" as any,
            input: { action: "click" } as any,
          },
          timestamp: 1,
          result: "Rendered **bold** output",
        },
      ],
      screenshots: [],
    });

    expect(report).toContain("```txt\nBroken");
    expect(report).toContain("https://example.com/?[redacted]");
    expect(report).toContain("&lt;img src=x&gt;");
    expect(report).toContain("[token]\\(");
    expect(report).toContain("\\*\\*bold\\*\\*");
  });

  it("does not include base64 image data", () => {
    const report = renderFailureReport({
      ...input,
      steps: [
        {
          reasoning: "Screenshot",
          action: {
            type: "tool_use",
            name: "screenshot" as any,
            input: { action: "screenshot" } as any,
          },
          timestamp: 1,
          result: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
        },
      ],
    });

    expect(report).not.toContain("iVBORw0KGgo");
    expect(report).toContain("[REDACTED:base64-image]");
  });

  it("renders only the last 10 steps", () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      reasoning: `step-${index.toString().padStart(2, "0")}`,
      action: {
        type: "tool_use" as const,
        name: "sleep" as any,
        input: { action: "sleep", duration: index } as any,
      },
      timestamp: index,
      result: `result-${index.toString().padStart(2, "0")}`,
    }));

    const report = renderFailureReport({ ...input, steps });

    expect(report).toContain("Showing last 10 of 12 steps.");
    expect(report).not.toContain("result-00");
    expect(report).not.toContain("result-01");
    expect(report).toContain("result-11");
  });

  it("renders screenshot embeds and links without raw bytes", () => {
    const report = renderFailureReport({
      ...input,
      screenshots: Array.from({ length: 6 }, (_, index) => ({
        fileName: `screenshot-${index}.png`,
        markdownPath: `run/screenshots/screenshot-${index}.png`,
      })),
    });

    expect(report).toContain("Screenshots are included for debugging");
    expect(report).toContain(
      "![Screenshot 1](run/screenshots/screenshot-1.png)",
    );
    expect(report).not.toContain(
      "![Screenshot 1](run/screenshots/screenshot-0.png)",
    );
    expect(report).toContain(
      "- [screenshot-0.png](run/screenshots/screenshot-0.png)",
    );
    expect(report).toContain(
      "- [screenshot-5.png](run/screenshots/screenshot-5.png)",
    );
  });

  it("renders an empty screenshot message", () => {
    const report = renderFailureReport({ ...input, screenshots: [] });

    expect(report).toContain("No screenshots recorded.");
  });

  it("is deterministic for the same input", () => {
    expect(renderFailureReport(input)).toBe(renderFailureReport(input));
  });
});
