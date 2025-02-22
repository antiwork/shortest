import * as fs from "fs/promises";
import path from "path";
import { CACHE_DIR_PATH } from "@/cache";
import { getLogger, Log } from "@/log";
import { CacheEntry, CacheStep } from "@/types/cache";
import type { TestFunction } from "@/types/test";
import { hashData } from "@/utils/crypto";
import { getErrorDetails } from "@/utils/errors";

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
  private readonly cacheFileName: string;
  private readonly cacheFilePath: string;
  private readonly lockFileName: string;
  private readonly lockFilePath: string;
  private readonly log: Log;
  private readonly MAX_LOCK_ATTEMPTS = 10;
  private readonly BASE_LOCK_DELAY_MS = 10;
  private lockAcquired = false;
  private steps: CacheStep[] = [];
  private identifier: string;
  private test: TestFunction;
  /**
   * Creates a new test cache instance
   * @param {TestFunction} test - Test function to cache results for
   */
  constructor(test: TestFunction, cacheDir = CACHE_DIR_PATH) {
    this.log = getLogger();
    this.log.trace("Initializing TestCache", { test });
    this.test = test;
    this.identifier = hashData(test);
    this.cacheDir = cacheDir;
    this.cacheFileName = `${this.identifier}.json`;
    this.cacheFilePath = path.join(this.cacheDir, this.cacheFileName);
    this.lockFileName = `${this.cacheFileName}.lock`;
    this.lockFilePath = path.join(this.cacheDir, this.lockFileName);
    this.setupProcessHandlers();
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
   */
  async get(): Promise<CacheEntry | null> {
    this.log.trace("Getting cache", {
      cacheFileName: this.cacheFileName,
      cacheFilePath: this.cacheFilePath,
    });

    if (!(await this.acquireLock())) {
      this.log.error("Failed to acquire lock for get", {
        cacheFileName: this.cacheFileName,
      });
      return null;
    }

    try {
      const content = await fs.readFile(this.cacheFilePath, "utf-8");
      return JSON.parse(content) as CacheEntry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      this.log.error("Failed to read cache file", {
        cacheFileName: this.cacheFileName,
        ...getErrorDetails(error),
      });
      return null;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Saves current test steps to cache
   */
  async set(): Promise<void> {
    this.log.trace("Setting cache", {
      cacheFileName: this.cacheFileName,
      stepCount: this.steps.length,
    });

    if (!(await this.acquireLock())) {
      this.log.error("Failed to acquire lock for set", {
        cacheFileName: this.cacheFileName,
      });
      return;
    }

    try {
      const cacheEntry: CacheEntry = {
        test: {
          name: this.test.name,
          filePath: this.test.filePath,
        },
        data: {
          steps: this.steps,
        },
        timestamp: Date.now(),
      };
      await fs.writeFile(
        this.cacheFilePath,
        JSON.stringify(cacheEntry, null, 2),
        "utf-8",
      );
    } catch (error) {
      this.log.error("Failed to write cache file", {
        cacheFileName: this.cacheFileName,
        ...getErrorDetails(error),
      });
    } finally {
      this.steps = [];
      await this.releaseLock();
    }
  }

  /**
   * Deletes cache file and associated lock file
   */
  async delete(): Promise<void> {
    this.log.trace("Deleting cache", {
      cacheFileName: this.cacheFileName,
    });

    try {
      await fs.unlink(this.cacheFilePath);
      await fs.unlink(this.lockFilePath);
    } catch (error) {
      this.log.error("Failed to delete cache file", {
        cacheFileName: this.cacheFileName,
        ...getErrorDetails(error),
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Adds a test execution step to be cached
   * @param {CacheStep} cacheStep - Step to add
   */
  addToSteps = (cacheStep: CacheStep) => {
    this.steps.push(cacheStep);
  };

  /**
   * Acquires a lock for cache file access
   * @returns {Promise<boolean>} Whether lock was acquired
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
  private async releaseLock(): Promise<void> {
    // this.log.trace("🔓", "Releasing lock", {
    //   lockFile: this.lockFile,
    // });

    try {
      const lockContent = await fs.readFile(this.lockFilePath, "utf-8");
      const { pid } = JSON.parse(lockContent);
      if (pid === process.pid) {
        await fs.unlink(this.lockFilePath);
        this.lockAcquired = false;
      } else {
        this.log.trace("Skipped releasing lock not owned by this process", {
          lockFilePath: this.lockFilePath,
          ownerPid: pid,
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.log.error("Failed to release lock", {
          lockFilePath: this.lockFilePath,
          ...getErrorDetails(error),
        });
      }
    }
  }

  /**
   * Checks if a process is still running
   * @param {number} pid - Process ID to check
   * @returns {boolean} Whether process is alive
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

  /**
   * Sets up process exit handlers for proper lock cleanup
   * @private
   */
  private setupProcessHandlers(): void {
    const releaseLockAndExit = async () => {
      if (this.lockAcquired) {
        await this.releaseLock();
      }
      process.exit();
    };
    process.on("exit", releaseLockAndExit);
    process.on("SIGINT", releaseLockAndExit);
    process.on("SIGTERM", releaseLockAndExit);
    process.on("uncaughtException", async (error) => {
      this.log.error("Uncaught exception", getErrorDetails(error));
      if (this.lockAcquired) {
        await releaseLockAndExit();
      }
    });
  }
}
