import * as fs from "fs";
import path from "path";
import { TestReporter } from "@/core/runner/test-reporter";
import { CacheEntry, CacheStore } from "@/types/cache";
import { hashData } from "@/utils/crypto";
import * as objects from "@/utils/objects";

export class BaseCache<T extends CacheEntry> {
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week
  private readonly CLEANUP_PROBABILITY = 0.03; // 3% chance

  private testReporter: TestReporter;

  private cacheFile: string;

  // Locking (ensures that only one process or thread can access or modify cache)
  private lockFile: string;
  private readonly LOCK_TIMEOUT_MS = 1_000;
  protected lockAcquired = false;
  protected lockAcquireFailures = 0;

  constructor() {
    this.testReporter = new TestReporter();
    this.cacheFile = path.join(process.cwd(), ".shortest", "cache.json");
    this.lockFile = path.join(process.cwd(), ".shortest", "cache.lock");
    this.ensureDirectory();
    this.setupProcessHandlers();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(path.dirname(this.cacheFile))) {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    }
  }

  private read(): CacheStore {
    if (fs.existsSync(this.cacheFile)) {
      try {
        return JSON.parse(
          fs.readFileSync(this.cacheFile, "utf-8"),
        ) as CacheStore;
      } catch {
        return {};
      }
    } else {
      return {};
    }
  }

  public async get(key: Record<any, any>): Promise<T | null> {
    if (!(await this.acquireLock())) {
      this.testReporter.error(
        "Cache",
        "Failed to acquire lock for set operation",
      );
      return null;
    }
    try {
      const hashedKey = hashData(key);
      const cache = this.read();
      return (cache[hashedKey] as T | undefined) ?? null;
    } catch {
      this.testReporter.error("Cache", "Failed to get");
      return null;
    } finally {
      this.releaseLock();
    }
  }

  public async set(
    key: Record<string, any>,
    value: Partial<T["data"]>,
  ): Promise<void> {
    if (!(await this.acquireLock())) {
      this.testReporter.error(
        "Cache",
        "Failed to acquire lock for set operation",
      );
      return;
    }
    try {
      const hashedKey = hashData(key);
      const cache = this.read();

      if (!cache[hashedKey]) {
        cache[hashedKey] = { data: {} } as T;
      }

      cache[hashedKey].data = objects.mergeDeep(cache[hashedKey].data, {
        ...value,
        timestamp: Date.now(),
      }) as T["data"];

      this.write(cache);
    } catch {
      this.testReporter.error("Cache", "Failed to set");
      this.reset();
    } finally {
      this.releaseLock();
      if (Math.random() < this.CLEANUP_PROBABILITY) {
        this.cleanup();
      }
    }
  }

  private reset(): void {
    try {
      fs.writeFileSync(this.cacheFile, "{}");
    } catch {
      this.testReporter.error("Cache", "Failed to reset");
    } finally {
      this.releaseLock();
    }
  }

  private write(cache: CacheStore): void {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
    } catch {
      this.testReporter.error("Cache", "Failed to write");
    }
  }

  public async delete(key: Record<string, any>): Promise<void> {
    if (!(await this.acquireLock())) {
      this.testReporter.error(
        "Cache",
        "Failed to acquire lock for delete operation",
      );
      return;
    }

    try {
      const hashedKey = hashData(key);
      const cache = this.read();

      if (cache[hashedKey]) {
        delete cache[hashedKey];
        this.write(cache);
      } else {
        this.testReporter.error("Cache", "Failed to delete: entry not found");
      }
    } catch {
      this.testReporter.error("Cache", "Failed to delete");
    }
  }

  private cleanup() {
    try {
      const cache = this.read();
      let cacheModified = false;
      for (const [key, value] of Object.entries(cache)) {
        if (value) {
          if (Date.now() - value.timestamp > this.CACHE_TTL) {
            delete cache[key];
            cacheModified = true;
          }
        }
      }

      if (cacheModified) {
        this.write(cache);
      }
    } catch {
      this.testReporter.error("Cache", "Failed to clean up");
    }
  }

  public async acquireLock(): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < this.LOCK_TIMEOUT_MS) {
      try {
        if (fs.existsSync(this.lockFile)) {
          const lockAge = Date.now() - fs.statSync(this.lockFile).mtimeMs;
          if (lockAge > this.LOCK_TIMEOUT_MS) {
            fs.unlinkSync(this.lockFile);
          }
        }

        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: "wx" });
        this.lockAcquireFailures = 0;
        this.lockAcquired = true;
        return true;
      } catch {
        this.testReporter.error("Cache", "Failed to acquire lock");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    this.testReporter.error("Cache", "Failed to acquire lock after timeout");
    this.lockAcquireFailures++;
    if (this.lockAcquireFailures >= 3) {
      this.testReporter.error(
        "Cache",
        "Failed to acquire lock 3 times in a row. Releasing lock manually.",
      );
      this.releaseLock();
    }
    return false;
  }

  public releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
      this.lockAcquired = false;
    } catch {
      this.testReporter.error("Cache", "Failed to release lock");
    }
  }

  private setupProcessHandlers(): void {
    const releaseLockAndExit = () => {
      this.releaseLock();
      process.exit();
    };

    process.on("exit", releaseLockAndExit);
    process.on("SIGINT", releaseLockAndExit);
    process.on("SIGTERM", releaseLockAndExit);
    process.on("uncaughtException", (err) => {
      this.testReporter.error("Cache", err.message);
      if (this.lockAcquired) {
        releaseLockAndExit();
      }
    });
  }
}
