import * as fs from "fs/promises";
import path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CACHE_DIR_PATH } from "@/cache";
import { TestCache } from "@/cache/test-cache";
import { CacheEntry, CacheStep } from "@/types/cache";
import { TestFunction } from "@/types/test";
import { createHash } from "@/utils/create-hash";

describe("TestCache", () => {
  interface TestContext {
    cacheDir: string;
  }

  let testCache: TestCache;
  const mockTest: TestFunction = {
    name: "test",
    filePath: "test.ts",
    fn: () => Promise.resolve(),
  };

  beforeEach<TestContext>(async (context) => {
    // Create and store the unique test directory in the context
    const uniqueId = createHash(
      {
        timestamp: Date.now(),
        random: Math.random(),
      },
      { length: 8 },
    );
    context.cacheDir = `${CACHE_DIR_PATH}.${uniqueId}.test`;

    vi.resetModules();
    await fs.mkdir(context.cacheDir, { recursive: true });
    testCache = new TestCache(mockTest, context.cacheDir);
    await testCache.initialize();
  });

  afterEach<TestContext>(async (context) => {
    await fs.rm(context.cacheDir, { recursive: true, force: true });
  });

  describe("get", () => {
    it("returns null when cache file doesn't exist", async () => {
      const result = await testCache.get();
      expect(result).toBeNull();
    });

    it("returns cached entry when file exists", async () => {
      const mockTimestamp = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      const mockEntry: CacheEntry = {
        test: { name: mockTest.name, filePath: mockTest.filePath },
        data: { steps: [] },
        metadata: { timestamp: mockTimestamp, version: "1" },
      };

      await testCache.set();
      const result = await testCache.get();
      expect(result).toEqual(mockEntry);

      vi.restoreAllMocks();
    });

    it<TestContext>("returns null on invalid JSON", async ({ cacheDir }) => {
      const cacheFilePath = path.join(
        cacheDir,
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
      const content = await fs.readFile(
        testCache["currentCacheFilePath"],
        "utf-8",
      );
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
      expect(testCache["steps"]).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it<TestContext>("removes cache and lock files", async ({ cacheDir }) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const cacheFileName = `${timestamp}_${testCache["identifier"]}.json`;
      const cacheFilePath = path.join(cacheDir, cacheFileName);
      const lockFilePath = path.join(
        cacheDir,
        `${testCache["identifier"]}.lock`,
      );

      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.writeFile(cacheFilePath, "test");
      await fs.writeFile(lockFilePath, "test");

      testCache["currentCacheFileName"] = cacheFileName;
      await testCache.delete();

      await expect(fs.access(cacheFilePath)).rejects.toThrow();
      await expect(fs.access(lockFilePath)).rejects.toThrow();
    });

    it("handles non-existent files gracefully", async () => {
      await expect(testCache.delete()).resolves.not.toThrow();
    });
  });

  describe("addToSteps", () => {
    it("adds steps to internal array", async () => {
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
    it<TestContext>("acquires and releases lock for operations", async ({
      cacheDir,
    }) => {
      const lockFilePath = path.join(
        cacheDir,
        `${testCache["identifier"]}.lock`,
      );

      await testCache.set();
      await expect(fs.access(lockFilePath)).rejects.toThrow(); // Lock should be released

      const result = await testCache.get();
      await expect(fs.access(lockFilePath)).rejects.toThrow(); // Lock should be released
      expect(result).not.toBeNull();
    });

    it<TestContext>("handles concurrent access attempts", async ({
      cacheDir,
    }) => {
      const otherCache = new TestCache(mockTest, cacheDir);
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
