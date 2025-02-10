import * as fs from "node:fs";
import path from "node:path";

import { DateUtil } from "@/utils/date";
import { CacheError } from "@/utils/errors";
import { CACHE_DIR, CACHE_LOCK_TIMEOUT_MS, CACHE_TTL } from "./constants";
import { FileLock } from "./file-lock";
import {
  CacheEntryIdentifier,
  CacheStore,
  ParsedCacheStore,
} from "./interfaces";

export class Cache {
  private cacheFile: string;
  private fileLock: FileLock;

  constructor(private id: CacheEntryIdentifier) {
    this.ensureDirectory();
    this.cleanupExpiredCache();
    this.setupProcessHandlers();

    const cacheFile = this.initCacheFile();
    this.cacheFile = path.join(CACHE_DIR, `${cacheFile}.json`);

    const lockFile = path.join(CACHE_DIR, `${cacheFile}.lock`);
    this.fileLock = new FileLock(lockFile, CACHE_LOCK_TIMEOUT_MS);
  }

  public async get(key: string): Promise<any | undefined> {
    return await this.withLock(() => {
      const map = this.loadCache();
      return map.get(key);
    });
  }

  public async set(key: string, value: any): Promise<void> {
    await this.withLock(() => {
      const map = this.loadCache();
      map.set(key, value);
      this.saveCache(map);
    });
  }

  public async delete(key: string): Promise<boolean> {
    return await this.withLock(() => {
      const map = this.loadCache();
      const existed = map.delete(key);
      if (existed) {
        this.saveCache(map);
      }
      return existed;
    });
  }

  public async clear(): Promise<void> {
    await this.withLock(() => {
      this.saveCache(new Map());
    });
  }

  public async getAll(): Promise<CacheStore> {
    return await this.withLock(() => {
      return new Map(this.loadCache());
    });
  }

  private async withLock<T>(callback: () => T): Promise<T> {
    if (!(await this.fileLock.acquire())) {
      throw new CacheError("file-lock", "Failed to acquire lock");
    }
    try {
      return callback();
    } finally {
      this.fileLock.release();
    }
  }

  private loadCache(): CacheStore {
    try {
      const data = fs.readFileSync(this.cacheFile, "utf-8");
      const parsed: ParsedCacheStore = JSON.parse(data);
      return new Map(Object.entries(parsed));
    } catch (error) {
      throw new CacheError("crud", `Failed to load cache: ${error}`);
    }
  }

  private saveCache(map: CacheStore): void {
    try {
      const obj = Object.fromEntries(map);
      fs.writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2));
    } catch (error) {
      throw new CacheError("crud", `Failed to save cache: ${error}`);
    }
  }

  private initCacheFile(): string {
    const cacheFiles = fs
      .readdirSync(CACHE_DIR)
      .filter((file) => file.endsWith(`-${this.id}.json`));

    // If one cache file found, return it
    if (cacheFiles.length === 1) {
      return path.parse(cacheFiles[0]).name;
    } else if (cacheFiles.length > 1) {
      // If more than one file found, delete them
      for (const file of cacheFiles) {
        try {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        } catch (error) {
          throw new CacheError(
            "file-system",
            `Failed to delete duplicate cache file ${file}: ${error}`,
          );
        }
      }
    }

    // If no cache files found, create new
    const baseFileName = `${DateUtil.getISODate(new Date())}-${this.id}`;
    const newFilePath = path.join(CACHE_DIR, `${baseFileName}.json`);
    try {
      fs.writeFileSync(newFilePath, "{}");
      console.log(`Created new cache file: ${newFilePath}`);
    } catch (error) {
      throw new CacheError("file-system", "Failed to create cache file.");
    }
    return baseFileName;
  }

  private cleanupExpiredCache(): void {
    let files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();

    for (const file of files) {
      const parsed = this.parseFileName(file);
      if (!parsed) {
        console.warn(`Skipping unrecognized file: ${file}`);
        continue;
      }
      if (now - DateUtil.parseISODate(parsed.timestamp).getTime() > CACHE_TTL) {
        try {
          fs.unlinkSync(path.join(CACHE_DIR, file));
          console.log(`Deleted expired cache file: ${file}`);
        } catch (error) {
          throw new CacheError(
            "file-system",
            `Failed to delete expired cache file ${file}`,
          );
        }
      }
    }
  }

  private parseFileName(fileName: string) {
    const baseName = path.parse(fileName).name;
    const separatorIndex = baseName.lastIndexOf("-");

    const timestamp = baseName.substring(0, separatorIndex);
    const id = baseName.substring(separatorIndex + 1);

    if (!timestamp || !id) return null;
    return { timestamp, id };
  }

  private setupProcessHandlers(): void {
    const cleanup = () => this.fileLock.release();
    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit();
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit();
    });
    process.on("uncaughtException", (err) => {
      console.error(err);
      cleanup();
      process.exit(1);
    });
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }
}
