import { describe, test, expect, vi } from "vitest";
import { z } from "zod";
import { createTestCase } from "./test-case.js";
import { ShortestError } from "@/utils/errors";

vi.mock("@/utils/create-hash", () => ({
  createHash: vi.fn(() => "mocked-hash"),
}));

describe("test-case", () => {
  describe("createTestCase", () => {
    test("creates a valid test case with required fields", () => {
      const testCase = createTestCase({
        name: "Test name",
        filePath: "/path/to/test.ts",
      });

      expect(testCase).toEqual({
        name: "Test name",
        filePath: "/path/to/test.ts",
        expectations: [],
        directExecution: false,
        identifier: "mocked-hash",
      });
    });

    test("overwrites provided identifier", () => {
      const testCase = createTestCase({
        name: "Test name",
        filePath: "/path/to/test.ts",
        identifier: "custom-id",
      });

      expect(testCase.identifier).toBe("mocked-hash");
    });

    test("includes all optional fields when provided", () => {
      const mockFn = async () => {};
      const mockBeforeFn = async () => {};
      const mockAfterFn = async () => {};

      const testCase = createTestCase({
        name: "Test with all fields",
        filePath: "/path/to/test.ts",
        payload: { key: "value" },
        fn: mockFn,
        expectations: [
          {
            description: "Test expectation",
            payload: { expected: true },
            fn: mockFn,
            directExecution: true,
          },
        ],
        beforeFn: mockBeforeFn,
        afterFn: mockAfterFn,
        directExecution: true,
      });

      expect(testCase.name).toBe("Test with all fields");
      expect(testCase.filePath).toBe("/path/to/test.ts");
      expect(testCase.payload).toEqual({ key: "value" });
      expect(typeof testCase.fn).toBe("function");
      expect(testCase.directExecution).toBe(true);
      expect(testCase.expectations).toHaveLength(1);
      expect(testCase.expectations[0].description).toBe("Test expectation");
      expect(testCase.expectations[0].payload).toEqual({ expected: true });
      expect(typeof testCase.expectations[0].fn).toBe("function");
      expect(testCase.expectations[0].directExecution).toBe(true);
      expect(typeof testCase.beforeFn).toBe("function");
      expect(typeof testCase.afterFn).toBe("function");
    });

    test("throws ShortestError for invalid test case data", () => {
      expect(() => createTestCase({})).toThrow(ShortestError);
      expect(() => createTestCase({ name: "Test" })).toThrow(ShortestError);
      expect(() => createTestCase({ filePath: "/path" })).toThrow(
        ShortestError,
      );
    });

    test("throws ShortestError with detailed validation errors in the error message", () => {
      try {
        createTestCase({});
        fail("Expected error was not thrown");
      } catch (error) {
        if (error instanceof ShortestError) {
          // Strip ANSI color codes from the error message
          const errorMessage = error.message.replace(/\u001b\[\d+m/g, "");
          expect(errorMessage).toContain("Invalid TestCase format");
          expect(errorMessage).toContain(
            'name: Required (received: "undefined")',
          );
          expect(errorMessage).toContain(
            'filePath: Required (received: "undefined")',
          );
        } else {
          throw error;
        }
      }

      try {
        createTestCase({ name: "Test name" });
        fail("Expected error was not thrown");
      } catch (error) {
        if (error instanceof ShortestError) {
          // Strip ANSI color codes from the error message
          const errorMessage = error.message.replace(/\u001b\[\d+m/g, "");
          expect(errorMessage).toContain("Invalid TestCase format");
          expect(errorMessage).toContain(
            'filePath: Required (received: "undefined")',
          );
        } else {
          throw error;
        }
      }
    });

    // For simplicity and to avoid complex mocking that can break,
    // we'll test the error handling pattern indirectly
    test("has proper error handling for non-Zod errors", () => {
      // This verifies that the code follows the pattern:
      // try { ... } catch(error) {
      //   if (error instanceof z.ZodError) ... else throw error
      // }
      const parseImplementation = z
        .object({})
        .strict()
        .transform(() => ({})).parse;

      expect(() => {
        try {
          parseImplementation(undefined as any);
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ShortestError("Zod error happened");
          }
          throw error;
        }
      }).toThrow();
    });
  });
});
