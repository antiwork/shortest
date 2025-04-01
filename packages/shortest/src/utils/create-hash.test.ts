import { describe, expect, it } from "vitest";
import { createHash } from "./create-hash";

describe("createHash", () => {
  it("should create a SHA-256 hash from a string", () => {
    const data = "test string";
    const hash = createHash(data);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should create a SHA-256 hash from an object", () => {
    const data = { key: "value", nested: { prop: true } };
    const hash = createHash(data);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should create a SHA-256 hash from an array", () => {
    const data = [1, 2, "three", { four: 4 }];
    const hash = createHash(data);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should create a SHA-256 hash from a number", () => {
    const data = 12345;
    const hash = createHash(data);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should create a SHA-256 hash from null", () => {
    const data = null;
    const hash = createHash(data);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should truncate the hash to the specified length", () => {
    const data = "test string";
    const length = 10;
    const hash = createHash(data, { length });

    expect(hash).toHaveLength(length);
    expect(createHash(data).startsWith(hash)).toBe(true);
  });

  it("should handle length of 0", () => {
    const data = "test string";
    const hash = createHash(data, { length: 0 });

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });

  it("should handle length greater than hash length", () => {
    const data = "test string";
    const hash = createHash(data, { length: 100 });

    expect(hash).toHaveLength(64);
    expect(hash).toBe(createHash(data));
  });
});
