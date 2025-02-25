import * as fs from "fs/promises";
import path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CACHE_DIR_PATH, CACHE_MAX_AGE_MS, cleanUpCache } from "@/cache";
import { CacheEntry } from "@/types/cache";
import { createHash } from "@/utils/create-hash";

describe("cache", () => {
  interface TestContext {
    cacheDirPath: string;
    mockCacheFilePath: string;
  }

  beforeEach<TestContext>(async (context) => {
    // Create and store the unique test directory in the context
    const uniqueId = createHash(
      {
        timestamp: Date.now(),
        random: Math.random(),
      },
      { length: 8 },
    );
    context.cacheDirPath = `${CACHE_DIR_PATH}.${uniqueId}.test`;
    context.mockCacheFilePath = path.join(context.cacheDirPath, "test.json");

    vi.resetModules();
    await fs.mkdir(context.cacheDirPath, { recursive: true });
  });

  afterEach<TestContext>(async (context) => {
    await fs.rm(context.cacheDirPath, { recursive: true, force: true });
  });

  describe("cleanUpCache", () => {
    it<TestContext>("removes expired cache entries", async ({
      cacheDirPath,
      mockCacheFilePath,
    }) => {
      const expiredEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        metadata: {
          timestamp: Date.now() - CACHE_MAX_AGE_MS - 1000,
          version: "1",
        },
      };
      await fs.writeFile(mockCacheFilePath, JSON.stringify(expiredEntry));
      await cleanUpCache({ dirPath: cacheDirPath });
      await expect(fs.access(mockCacheFilePath)).rejects.toThrow();
    });

    it<TestContext>("keeps valid cache entries", async ({
      cacheDirPath,
      mockCacheFilePath,
    }) => {
      const validEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        metadata: {
          timestamp: Date.now() - 1000,
          version: "1",
        },
      };

      await fs.writeFile(mockCacheFilePath, JSON.stringify(validEntry));
      await cleanUpCache({ dirPath: cacheDirPath });

      await expect(fs.access(mockCacheFilePath)).resolves.toBeUndefined();
    });

    it<TestContext>("removes all cache entries when forcePurge is true", async ({
      cacheDirPath,
      mockCacheFilePath,
    }) => {
      const validEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        metadata: {
          timestamp: Date.now(),
          version: "1",
        },
      };

      await fs.writeFile(mockCacheFilePath, JSON.stringify(validEntry));
      await cleanUpCache({ forcePurge: true, dirPath: cacheDirPath });

      await expect(fs.access(mockCacheFilePath)).rejects.toThrow();
    });

    it<TestContext>("removes invalid cache files", async ({
      cacheDirPath,
      mockCacheFilePath,
    }) => {
      await fs.writeFile(mockCacheFilePath, "invalid json");
      await cleanUpCache({ dirPath: cacheDirPath });

      await expect(fs.access(mockCacheFilePath)).rejects.toThrow();
    });

    it<TestContext>("ignores non-JSON files", async ({ cacheDirPath }) => {
      const nonJsonFile = path.join(cacheDirPath, "test.txt");
      await fs.writeFile(nonJsonFile, "test content");
      await cleanUpCache({ dirPath: cacheDirPath });

      await expect(fs.access(nonJsonFile)).resolves.toBeUndefined();
    });

    it("handles non-existent cache directory", async () => {
      const nonExistentDir = path.join(CACHE_DIR_PATH, "non-existent");
      await expect(
        cleanUpCache({ dirPath: nonExistentDir }),
      ).resolves.toBeUndefined();
    });
  });
});
