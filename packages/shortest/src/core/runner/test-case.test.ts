import { describe, expect, it, vi } from "vitest";
import { createTestCase } from "@/core/runner/test-case";

describe("createTestCase", () => {
  it("creates a test case with the provided name and function", () => {
    const name = "Test Case";
    const filePath = "/path/to/test.ts";
    const fn = async () => {};
    
    const testCase = createTestCase({ name, filePath, fn });
    
    expect(testCase.name).toBe(name);
    expect(testCase.filePath).toBe(filePath);
  });
  
  it("generates a unique identifier based on name and file path", () => {
    const name = "Test Case";
    const filePath = "/path/to/test.ts";
    const fn = async () => {};
    
    const testCase = createTestCase({ name, filePath, fn });
    
    expect(testCase.identifier).toBeDefined();
    expect(typeof testCase.identifier).toBe("string");
    expect(testCase.identifier.length).toBeGreaterThan(0);
  });
  
  it("generates different identifiers for different test cases", () => {
    const testCase1 = createTestCase({
      name: "Test Case 1",
      filePath: "/path/to/test1.ts",
      fn: async () => {},
    });
    
    const testCase2 = createTestCase({
      name: "Test Case 2",
      filePath: "/path/to/test2.ts",
      fn: async () => {},
    });
    
    expect(testCase1.identifier).not.toBe(testCase2.identifier);
  });
});
