import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "@/ai/utils/json";

describe("extractJsonPayload", () => {
  it("extracts and validates JSON payload", () => {
    const validJSON = '{"status": "passed", "reason": "Test passed"}';
    const result = extractJsonPayload(validJSON);
    
    expect(result).toEqual({
      status: "passed",
      reason: "Test passed",
    });
  });
  
  it("throws error when no JSON is found", () => {
    const invalidJSON = 'No JSON here';
    
    expect(() => extractJsonPayload(invalidJSON)).toThrow();
  });
  
  it("throws error when multiple JSON objects are found", () => {
    const multipleJSON = '{"status": "passed", "reason": "Test passed"} {"status": "failed", "reason": "Test failed"}';
    
    expect(() => extractJsonPayload(multipleJSON)).toThrow();
  });
  
  it("throws error when JSON parsing fails", () => {
    const invalidJSON = '{"status": "passed", "reason": "Test passed",}';
    
    expect(() => extractJsonPayload(invalidJSON)).toThrow();
  });
  
  it("throws error when validation fails", () => {
    const invalidJSON = '{"status": "invalid", "reason": "Test failed"}';
    
    expect(() => extractJsonPayload(invalidJSON)).toThrow();
  });
});
