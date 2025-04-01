import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJsonPayload } from "./json";

describe("extractJsonPayload", () => {
  const validResponse = '{"status": "passed", "reason": "test passed"}';
  const customSchema = z.object({
    status: z.enum(["passed", "failed"]),
    reason: z.string(),
  });

  it("extracts and validates a valid JSON payload", () => {
    const result = extractJsonPayload(validResponse);
    expect(result).toEqual({
      status: "passed",
      reason: "test passed",
    });
  });

  it("throws AIError when no JSON is found", () => {
    expect(() => extractJsonPayload("no json here")).toThrowError(
      expect.objectContaining({
        name: "AIError",
        message: "AI didn't return the expected JSON payload.",
      }),
    );
  });

  it("throws AIError when multiple JSON objects are found", () => {
    const multipleJson = '{"a": 1} {"b": 2}';
    expect(() => extractJsonPayload(multipleJson)).toThrowError(
      expect.objectContaining({
        name: "AIError",
        message: "Ambiguous JSON: multiple JSON objects found.",
      }),
    );
  });

  it("throws on invalid JSON syntax", () => {
    const invalidJson = '{"status": "passed", reason: "missing quotes"}';
    expect(() => extractJsonPayload(invalidJson)).toThrow(SyntaxError);
  });

  it("throws AIError on schema validation failure", () => {
    const invalidStatus = '{"status": "invalid", "reason": "test"}';
    expect(() => extractJsonPayload(invalidStatus)).toThrowError(
      expect.objectContaining({
        name: "AIError",
      }),
    );
  });

  it("validates against the default schema", () => {
    const validCustomJson = '{"status": "passed", "reason": "test"}';
    const result = extractJsonPayload(validCustomJson, customSchema);
    expect(result).toEqual({
      status: "passed",
      reason: "test",
    });
  });

  it("handles JSON within other text", () => {
    const mixedContent =
      'Some text before {"status": "passed", "reason": "test"} and after';
    const result = extractJsonPayload(mixedContent);
    expect(result).toEqual({
      status: "passed",
      reason: "test",
    });
  });
});
