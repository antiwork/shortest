import * as fs from "fs/promises";
import path from "path";
import { CACHE_DIR_PATH } from "@/cache";
import { getLogger, Log } from "@/log";
import { CacheEntry, CacheStep } from "@/types/cache";
import type { TestFunction } from "@/types/test";
import { createHash } from "@/utils/create-hash";
import { getErrorDetails, ShortestError } from "@/utils/errors";

// Shared process handlers registration
let handlersRegistered = false;
const registerSharedProcessHandlers = (log: Log) => {
  if (handlersRegistered) return;

  const activeCaches = new Set<TestCache>();

  const cleanUpAndExit = async () => {
    await Promise.all([...activeCaches].map((cache) => cache.releaseLock()));
    process.exit();
  };

  process.on("exit", cleanUpAndExit);
  process.on("SIGINT", cleanUpAndExit);
  process.on("SIGTERM", cleanUpAndExit);
  process.on("uncaughtException", async (error) => {
    log.error("Uncaught exception", getErrorDetails(error));
    await cleanUpAndExit();
  });

  handlersRegistered = true;
  return activeCaches;
};

/**
 * Test result caching system with file locking mechanism.
 *
 * @class
 * @example
 * ```typescript
 * const testCache = new TestCache(testFunction);
 * await testCache.initialize();
 * await testCache.get();
 * testCache.addToSteps(step);
 * await testCache.set();
 * ```
 *
 * @see {@link CacheEntry} for cache data structure
 * @see {@link CacheStep} for step data structure
 *
 * @private
 */
export class TestCache {
  private readonly cacheDir: string;
  private readonly cacheFileNameSuffix: string; // e.g., "_a1b2c3d4.json"
  private currentCacheFileName: string | undefined = undefined; // e.g. "2025-02-22T12-34-56-a1b2c3d4.json"
  private get currentCacheFilePath(): string {
    if (!this.currentCacheFileName) {
      throw new ShortestError("currentCacheFilePath is not set");
    }
    return path.join(this.cacheDir, this.currentCacheFileName);
  }
  private readonly lockFileName: string;
  private get lockFilePath(): string {
    return path.join(this.cacheDir, this.lockFileName);
  }
  private readonly log: Log;
  private readonly MAX_LOCK_ATTEMPTS = 10;
  private readonly BASE_LOCK_DELAY_MS = 10;
  private lockAcquired = false;
  private steps: CacheStep[] = [];
  private identifier: string;
  private test: TestFunction;
  private static activeCaches: Set<TestCache>;

  /**
   * Creates a new test cache instance
   * @param {TestFunction} test - Test function to cache results for
   */
  constructor(test: TestFunction, cacheDir = CACHE_DIR_PATH) {
    this.log = getLogger();
    this.log.trace("Initializing TestCache");
    this.test = test;
    // Low collision risk for datasets under 65,000 tests
    this.identifier = createHash(test, { length: 8 });
    this.cacheDir = cacheDir;
    this.cacheFileNameSuffix = `_${this.identifier}.json`;
    this.lockFileName = `${this.identifier}.lock`;

    // Register shared handlers and track this instance
    TestCache.activeCaches =
      registerSharedProcessHandlers(this.log) || TestCache.activeCaches;
    TestCache.activeCaches.add(this);
  }

  /**
   * Initializes the cache instance
   * @private
   */
  async initialize(): Promise<void> {
    await this.ensureCacheDirectory();
  }

  /**
   * Ensures cache directory exists
   * @private
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      this.log.error(
        "Failed to create cache directory",
        getErrorDetails(error),
      );
    }
  }

  /**
   * Retrieves cached test result if available
   * @returns {Promise<CacheEntry | null>} Cached entry or null if not found
   * @private
   */
  async get(): Promise<CacheEntry | null> {
    this.log.trace("Retrieving cache", {
      identifier: this.identifier,
    });

    if (!(await this.acquireLock())) {
      this.log.error("Failed to acquire lock for cache retrieval", {
        identifier: this.identifier,
      });
      return null;
    }

    try {
      const files = (await fs.readdir(this.cacheDir)).filter((f) =>
        f.endsWith(this.cacheFileNameSuffix),
      );

      if (!files.length) {
        this.log.trace("No cache file found", { identifier: this.identifier });
        return null;
      }

      if (files.length > 1) {
        this.log.warn("Multiple cache files detected, using the first one", {
          identifier: this.identifier,
          files,
        });
      }

      // Use the first (and ideally only) file
      const fileName = files[0];
      const filePath = path.join(this.cacheDir, fileName);
      const content = await fs.readFile(filePath, "utf-8");
      const cacheEntry = JSON.parse(content) as CacheEntry;
      this.currentCacheFileName = fileName;
      this.log.debug("Cache entry loaded", { fileName });
      return cacheEntry;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        this.log.trace("Cache file not found during read", {
          identifier: this.identifier,
        });
        return null;
      }
      this.log.error("Failed to read cache", {
        identifier: this.identifier,
        ...getErrorDetails(error),
      });
      return null;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Saves current test steps to cache
   * @returns {Promise<void>} Resolves when cache is set
   * @private
   */
  async set(): Promise<void> {
    this.log.trace("Setting cache", {
      identifier: this.identifier,
      stepCount: this.steps.length,
    });

    if (!(await this.acquireLock())) {
      this.log.error("Failed to acquire lock for set", {
        identifier: this.identifier,
      });
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.currentCacheFileName = `${timestamp}${this.cacheFileNameSuffix}`;

      const cacheEntry: CacheEntry = {
        metadata: {
          timestamp: Date.now(),
          version: "1",
        },
        test: {
          name: this.test.name,
          filePath: this.test.filePath,
        },
        data: {
          steps: this.steps,
        },
      };
      await fs.writeFile(
        this.currentCacheFilePath,
        JSON.stringify(cacheEntry, null, 2),
        "utf-8",
      );

      const oldFiles = (await fs.readdir(this.cacheDir)).filter(
        (f) =>
          f.endsWith(this.cacheFileNameSuffix) &&
          f !== this.currentCacheFileName,
      );
      for (const oldFile of oldFiles) {
        await fs.unlink(path.join(this.cacheDir, oldFile));
        this.log.trace("Deleted older cache file", { file: oldFile });
      }
    } catch (error) {
      this.log.error("Failed to write cache file", {
        cacheFileName: this.currentCacheFileName,
        ...getErrorDetails(error),
      });
    } finally {
      this.steps = [];

      await this.releaseLock();
    }
  }

  /**
   * Deletes cache file and associated lock file
   * @returns {Promise<void>} Resolves when cache is deleted
   * @private
   */
  async delete(): Promise<void> {
    this.log.trace("Deleting cache", {
      cacheFileName: this.currentCacheFileName,
    });

    try {
      await fs.unlink(this.currentCacheFilePath);
      fs.unlink(this.lockFilePath).catch(() => {});
    } catch (error) {
      this.log.error("Failed to delete cache file", {
        cacheFileName: this.currentCacheFileName,
        ...getErrorDetails(error),
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Adds a test execution step to be cached
   * @param {CacheStep} cacheStep - Step to add
   * @private
   */
  addToSteps = (cacheStep: CacheStep) => {
    this.steps.push(cacheStep);
  };

  /**
   * Acquires a lock for cache file access
   * @returns {Promise<boolean>} True if lock was acquired, false otherwise
   * @private
   */
  private async acquireLock(): Promise<boolean> {
    // this.log.trace("🔒", "Acquiring lock", {
    //   lockFile: this.lockFile,
    // });

    const lockData = { pid: process.pid, timestamp: Date.now() };
    for (let attempt = 0; attempt < this.MAX_LOCK_ATTEMPTS; attempt++) {
      try {
        await fs.writeFile(this.lockFilePath, JSON.stringify(lockData), {
          flag: "wx",
        });
        this.lockAcquired = true;
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          const lockContent = await fs
            .readFile(this.lockFilePath, "utf-8")
            .catch(() => null);
          if (lockContent) {
            try {
              const { pid, timestamp } = JSON.parse(lockContent);
              const age = Date.now() - timestamp;
              if (age > 10_000 && !this.isProcessAlive(pid)) {
                // 10s stale threshold
                await fs.unlink(this.lockFilePath).catch(() => {});
                continue; // Retry after removing stale lock
              }
            } catch (parseError) {
              this.log.error("Failed to parse lock file", {
                lockFilePath: this.lockFilePath,
                ...getErrorDetails(parseError),
              });
            }
          }
          const delay = this.BASE_LOCK_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.log.error("Unexpected lock acquisition error", {
            lockFileName: this.lockFileName,
            ...getErrorDetails(error),
          });
          return false;
        }
      }
    }
    this.log.error("Failed to acquire lock after max attempts", {
      lockFileName: this.lockFileName,
    });
    return false;
  }

  /**
   * Releases previously acquired lock
   * @private
   */
  public async releaseLock(): Promise<void> {
    if (this.lockAcquired) {
      try {
        await fs.unlink(this.lockFilePath);
        this.lockAcquired = false;
        TestCache.activeCaches.delete(this);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.log.error("Failed to release lock", {
            lockFilePath: this.lockFilePath,
            ...getErrorDetails(error),
          });
        }
      }
    }
  }

  /**
   * Checks if a process is still running
   * @param {number} pid - Process ID to check
   * @returns {boolean} True if process is alive, false otherwise
   * @private
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 checks existence
      return true;
    } catch (error) {
      this.log.error(
        "Failed to check if process is alive",
        getErrorDetails(error),
      );
      return false;
    }
  }
}
