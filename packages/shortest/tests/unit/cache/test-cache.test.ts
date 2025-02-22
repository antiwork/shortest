import * as fs from "fs/promises";
import path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CACHE_DIR_PATH } from "@/cache";
import { TestCache } from "@/cache/test-cache";
import { CacheEntry, CacheStep } from "@/types/cache";
import { TestFunction } from "@/types/test";

const TEST_CACHE_DIR_PATH = `${CACHE_DIR_PATH}.test`;

describe("TestCache", () => {
  let testCache: TestCache;
  const mockTest: TestFunction = {
    name: "test",
    filePath: "test.ts",
    fn: () => Promise.resolve(),
  };

  beforeEach(async () => {
    vi.resetModules();
    await fs.mkdir(TEST_CACHE_DIR_PATH, { recursive: true });
    testCache = new TestCache(mockTest, TEST_CACHE_DIR_PATH);
    await testCache.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_CACHE_DIR_PATH, { recursive: true, force: true });
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("get", () => {
    it("returns null when cache file doesn't exist", async () => {
      const result = await testCache.get();
      expect(result).toBeNull();
    });

    it("returns cached entry when file exists", async () => {
      const mockEntry: CacheEntry = {
        test: { name: mockTest.name, filePath: mockTest.filePath },
        data: { steps: [] },
        timestamp: Date.now(),
      };

      await testCache.set();
      const result = await testCache.get();
      expect(result).toEqual(mockEntry);
    });

    it("returns null on invalid JSON", async () => {
      const cacheFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json`,
      );
      await fs.writeFile(cacheFilePath, "invalid json");

      const result = await testCache.get();
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("saves cache entry with steps", async () => {
      const mockStep: CacheStep = {
        reasoning: "test reason",
        action: null,
        timestamp: Date.now(),
        result: "test result",
      };

      testCache.addToSteps(mockStep);
      await testCache.set();

      const cacheFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json`,
      );

      // Wait for the file to be written
      await new Promise((resolve) => setTimeout(resolve, 500));

      const content = await fs.readFile(cacheFilePath, "utf-8");
      const savedEntry = JSON.parse(content) as CacheEntry;

      expect(savedEntry.test).toEqual({
        name: mockTest.name,
        filePath: mockTest.filePath,
      });
      expect(savedEntry.data.steps).toHaveLength(1);
      expect(savedEntry.data.steps![0]).toEqual(mockStep);
    });

    it("clears steps after saving", async () => {
      const mockStep: CacheStep = {
        reasoning: "test reason",
        action: null,
        timestamp: Date.now(),
        result: "test result",
      };

      testCache.addToSteps(mockStep);
      await testCache.set();
      await testCache.set(); // Second save should write empty steps

      const cacheFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json`,
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const content = await fs.readFile(cacheFilePath, "utf-8");
      const savedEntry = JSON.parse(content) as CacheEntry;

      expect(savedEntry.data.steps).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("removes cache and lock files", async () => {
      const cacheFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json`,
      );
      const lockFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json.lock`,
      );

      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.writeFile(cacheFilePath, "test");
      await fs.writeFile(lockFilePath, "test");

      await testCache.delete();

      await expect(fs.access(cacheFilePath)).rejects.toThrow();
      await expect(fs.access(lockFilePath)).rejects.toThrow();
    });

    it("handles non-existent files gracefully", async () => {
      await expect(testCache.delete()).resolves.not.toThrow();
    });
  });

  describe("addToSteps", () => {
    it("adds steps to internal array", () => {
      const mockStep: CacheStep = {
        reasoning: "test reason",
        action: null,
        timestamp: Date.now(),
        result: "test result",
      };

      testCache.addToSteps(mockStep);
      testCache.addToSteps(mockStep);

      expect(testCache["steps"]).toHaveLength(2);
      expect(testCache["steps"]).toEqual([mockStep, mockStep]);
    });
  });

  describe("file locking", () => {
    it("acquires and releases lock for operations", async () => {
      const lockFilePath = path.join(
        TEST_CACHE_DIR_PATH,
        `${testCache["identifier"]}.json.lock`,
      );

      await testCache.set();
      await expect(fs.access(lockFilePath)).rejects.toThrow(); // Lock should be released

      const result = await testCache.get();
      await expect(fs.access(lockFilePath)).rejects.toThrow(); // Lock should be released
      expect(result).not.toBeNull();
    });

    it("handles concurrent access attempts", async () => {
      const otherCache = new TestCache(mockTest, TEST_CACHE_DIR_PATH);
      const mockStep: CacheStep = {
        reasoning: "test reason",
        action: null,
        timestamp: Date.now(),
        result: "test result",
      };

      // Simulate concurrent access
      const promises = [
        testCache.set(),
        otherCache.set(),
        testCache.addToSteps(mockStep),
        otherCache.addToSteps(mockStep),
        testCache.get(),
        otherCache.get(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});
