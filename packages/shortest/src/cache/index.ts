import { existsSync } from "fs";
import * as fs from "fs/promises";
import path from "path";
import { TestCache } from "@/cache/test-cache";
import { getLogger } from "@/log";
import { CacheEntry } from "@/types/cache";
import { getErrorDetails } from "@/utils/errors";

export { TestCache };

export const CACHE_DIR = path.join(process.cwd(), ".shortest", "cache");

export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

interface CleanUpCacheOptions {
  forcePurge?: boolean;
}

export const cleanUpCache = async ({
  forcePurge = false,
}: CleanUpCacheOptions = {}) => {
  const log = getLogger();
  log.debug("Cleaning up cache", { forcePurge });
  const files = await fs.readdir(CACHE_DIR);
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(CACHE_DIR, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry;

      if (forcePurge || now - entry.timestamp > CACHE_MAX_AGE_MS) {
        await fs.unlink(filePath);
        log.trace("Cache file removed", { file: filePath });
      }
    } catch (error) {
      log.error("Failed to process cache file", {
        file: filePath,
        ...getErrorDetails(error),
      });
      await fs.unlink(filePath);
      log.error("Invalid cache file removed", { file: filePath });
    }
  }
};

export const purgeLegacyCache = async () => {
  const log = getLogger();
  const legacyCachePath = path.join(process.cwd(), ".shortest", "cache.json");

  if (!existsSync(legacyCachePath)) {
    return;
  }

  log.warn(`Purging legacy cache file ${legacyCachePath}`);

  try {
    await fs.unlink(legacyCachePath);
    log.debug(`Legacy cache file ${legacyCachePath} purged`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error("Failed to purge legacy cache file", {
        file: legacyCachePath,
        ...getErrorDetails(error),
      });
    }
  }
};
