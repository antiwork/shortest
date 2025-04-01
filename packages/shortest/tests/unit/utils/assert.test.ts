import { describe, expect, it } from "vitest";
import { assert, assertDefined } from "@/utils/assert";
import { ShortestError } from "@/utils/errors";

describe("assert", () => {
  it("does not throw when condition is true", () => {
    expect(() => assert(true)).not.toThrow();
  });

  it("throws ShortestError when condition is false", () => {
    expect(() => assert(false)).toThrow(ShortestError);
  });

  it("throws ShortestError with default message when no message provided", () => {
    try {
      assert(false);
    } catch (error) {
      expect(error instanceof ShortestError).toBe(true);
      if (error instanceof ShortestError) {
        expect(error.message).toBe("Assertion failed");
      }
    }
  });

  it("throws ShortestError with custom message when provided", () => {
    const customMessage = "Custom assertion error";
    try {
      assert(false, customMessage);
    } catch (error) {
      expect(error instanceof ShortestError).toBe(true);
      if (error instanceof ShortestError) {
        expect(error.message).toBe(customMessage);
      }
    }
  });
});

describe("assertDefined", () => {
  it("returns the value when it is defined", () => {
    const value = "test";
    expect(assertDefined(value)).toBe(value);
  });

  it("returns the value when it is 0", () => {
    expect(assertDefined(0)).toBe(0);
  });

  it("returns the value when it is false", () => {
    expect(assertDefined(false)).toBe(false);
  });

  it("returns the value when it is an empty string", () => {
    expect(assertDefined("")).toBe("");
  });

  it("throws ShortestError when value is null", () => {
    expect(() => assertDefined(null)).toThrow(ShortestError);
  });

  it("throws ShortestError when value is undefined", () => {
    expect(() => assertDefined(undefined)).toThrow(ShortestError);
  });

  it("throws ShortestError with default message when no message provided", () => {
    try {
      assertDefined(null);
    } catch (error) {
      expect(error instanceof ShortestError).toBe(true);
      if (error instanceof ShortestError) {
        expect(error.message).toBe("Assertion failed");
      }
    }
  });

  it("throws ShortestError with custom message when provided", () => {
    const customMessage = "Value must be defined";
    try {
      assertDefined(undefined, customMessage);
    } catch (error) {
      expect(error instanceof ShortestError).toBe(true);
      if (error instanceof ShortestError) {
        expect(error.message).toBe(customMessage);
      }
    }
  });
});
