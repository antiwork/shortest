import * as fs from "fs/promises";
import path from "path";
import { CACHE_DIR } from "@/cache";
import { getLogger, Log } from "@/log";
import { CacheEntry, CacheStep } from "@/types/cache";
import type { TestFunction } from "@/types/test";
import { hashData } from "@/utils/crypto";
import { getErrorDetails } from "@/utils/errors";

export class TestCache {
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

  constructor(test: TestFunction) {
    this.log = getLogger();
    this.log.trace("Initializing TestCache", { test });
    this.test = test;
    this.identifier = hashData(test);
    this.cacheFileName = `${this.identifier}.json`;
    this.cacheFilePath = path.join(CACHE_DIR, this.cacheFileName);
    this.lockFileName = `${this.cacheFileName}.lock`;
    this.lockFilePath = path.join(CACHE_DIR, this.lockFileName);
    this.ensureCacheDirectory();
    this.setupProcessHandlers();
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      this.log.error(
        "Failed to create cache directory",
        getErrorDetails(error),
      );
    }
  }

  async get(): Promise<CacheEntry | null> {
    this.log.trace("Getting cache", {
      cacheFileName: this.cacheFileName,
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

  addToSteps = (cacheStep: CacheStep) => {
    this.steps.push(cacheStep);
  };

  saveScreenshot = (_base64Image: string): string => "";

  async cleanup(maxFiles: number, maxAgeHours: number): Promise<void> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      const cacheFiles = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => ({
            name: file,
            path: path.join(CACHE_DIR, file),
            lock: path.join(CACHE_DIR, `${file}.lock`),
            time: (await fs.stat(path.join(CACHE_DIR, file))).mtime.getTime(),
          })),
      );
      cacheFiles.sort((a, b) => b.time - a.time);

      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      for (const [index, file] of cacheFiles.entries()) {
        const isOld = now - file.time > maxAgeMs;
        const isBeyondLimit = index >= maxFiles;

        if (isOld || isBeyondLimit) {
          if (!(await this.acquireLock())) {
            this.log.error("Failed to acquire lock for cleanup", {
              cacheFile: file.path,
            });
            continue;
          }
          try {
            await fs.unlink(file.path);
            this.log.debug("Removed cache file", { file: file.path });
          } catch (error) {
            this.log.error("Failed to remove cache file", {
              file: file.path,
              ...getErrorDetails(error),
            });
          } finally {
            await this.releaseLock();
          }
        }
      }
    } catch (error) {
      this.log.error("Failed to clean up cache directory", { error });
    }
  }

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
