import { existsSync } from "fs";
import * as fs from "fs/promises";
import path from "path";
import { TestCache } from "@/cache/test-cache";
import { getLogger } from "@/log";
import { CacheEntry } from "@/types/cache";
import { getErrorDetails } from "@/utils/errors";

export { TestCache };

export const DOT_SHORTEST_DIR_NAME = ".shortest";
export const DOT_SHORTEST_DIR_PATH = path.join(
  process.cwd(),
  DOT_SHORTEST_DIR_NAME,
);
export const CACHE_DIR_PATH = path.join(DOT_SHORTEST_DIR_PATH, "cache");

export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Removes expired cache entries and optionally purges all cache
 *
 * @param {{ forcePurge?: boolean, dirPath?: string }} options - Cleanup options where forcePurge forces removal of all entries regardless of age
 * @private
 */
export const cleanUpCache = async ({
  forcePurge = false,
  dirPath = CACHE_DIR_PATH,
}: {
  forcePurge?: boolean;
  dirPath?: string;
} = {}) => {
  const log = getLogger();
  log.debug("Cleaning up cache", { forcePurge });

  if (!existsSync(dirPath)) {
    log.debug("Cache directory does not exist", { dirPath });
    return;
  }

  const files = await fs.readdir(dirPath);
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(dirPath, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry;

      if (forcePurge || now - entry.metadata.timestamp > CACHE_MAX_AGE_MS) {
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

/**
 * Removes legacy cache file from older versions
 *
 * @param {{ dirPath?: string }} options - Cleanup options where dirPath is the path to the SHORTEST_DIR_NAME directory
 * @private
 */
export const purgeLegacyCache = async ({
  dirPath = DOT_SHORTEST_DIR_PATH,
}: {
  dirPath?: string;
} = {}) => {
  const log = getLogger();
  const legacyCachePath = path.join(dirPath, "cache.json");

  if (!existsSync(legacyCachePath)) {
    return;
  }

  log.warn(`Purging legacy cache file (v0.4.3 and below): ${legacyCachePath}`);

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
