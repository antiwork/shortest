import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { CACHE_DIR_PATH, getTestCachePath } from "@/cache";
import { createTestCase } from "@/core/runner/test-case";

describe("cache", () => {
  describe("getTestCachePath", () => {
    const mockTest = createTestCase({
      name: "Test Cache Path",
      filePath: "/path/to/test.ts",
      fn: () => Promise.resolve(),
    });

    it("returns the correct cache path for a test", () => {
      const cachePath = getTestCachePath(mockTest);
      expect(cachePath).toBe(
        path.join(CACHE_DIR_PATH, `${mockTest.identifier}.json`),
      );
    });

    it("handles custom cache directory", () => {
      const customDir = "/custom/cache/dir";
      const cachePath = getTestCachePath(mockTest, customDir);
      expect(cachePath).toBe(
        path.join(customDir, `${mockTest.identifier}.json`),
      );
    });
  });
});
