import * as fs from "fs/promises";
import path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CACHE_DIR_PATH, CACHE_MAX_AGE_MS, cleanUpCache } from "@/cache";
import { CacheEntry } from "@/types/cache";

const TEST_CACHE_DIR_PATH = `${CACHE_DIR_PATH}.test`;

describe("cache", () => {
  const mockCacheFile = path.join(TEST_CACHE_DIR_PATH, "test.json");

  beforeEach(async () => {
    vi.resetModules();
    await fs.mkdir(TEST_CACHE_DIR_PATH, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_CACHE_DIR_PATH, { recursive: true, force: true });
  });

  describe("cleanUpCache", () => {
    it("removes expired cache entries", async () => {
      const expiredEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        timestamp: Date.now() - CACHE_MAX_AGE_MS - 1000,
      };
      await fs.writeFile(mockCacheFile, JSON.stringify(expiredEntry));
      await cleanUpCache({ dirPath: TEST_CACHE_DIR_PATH });
      await expect(fs.access(mockCacheFile)).rejects.toThrow();
    });

    it("keeps valid cache entries", async () => {
      const validEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        timestamp: Date.now() - 1000,
      };

      await fs.writeFile(mockCacheFile, JSON.stringify(validEntry));
      await cleanUpCache({ dirPath: TEST_CACHE_DIR_PATH });

      await expect(fs.access(mockCacheFile)).resolves.toBeUndefined();
    });

    it("removes all cache entries when forcePurge is true", async () => {
      const validEntry: CacheEntry = {
        test: { name: "test", filePath: "test.ts" },
        data: { steps: [] },
        timestamp: Date.now(),
      };

      await fs.writeFile(mockCacheFile, JSON.stringify(validEntry));
      await cleanUpCache({ forcePurge: true, dirPath: TEST_CACHE_DIR_PATH });

      await expect(fs.access(mockCacheFile)).rejects.toThrow();
    });

    it("removes invalid cache files", async () => {
      await fs.writeFile(mockCacheFile, "invalid json");
      await cleanUpCache({ dirPath: TEST_CACHE_DIR_PATH });

      await expect(fs.access(mockCacheFile)).rejects.toThrow();
    });

    it("ignores non-JSON files", async () => {
      const nonJsonFile = path.join(TEST_CACHE_DIR_PATH, "test.txt");
      await fs.writeFile(nonJsonFile, "test content");
      await cleanUpCache({ dirPath: TEST_CACHE_DIR_PATH });

      await expect(fs.access(nonJsonFile)).resolves.toBeUndefined();
    });
  });
});
