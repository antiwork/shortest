import { existsSync } from "fs";
import * as fs from "fs/promises";
import path from "path";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { getLogger } from "@/log";
import { CacheEntry } from "@/types/cache";
import { directoryExists } from "@/utils/directory-exists";
import { getErrorDetails } from "@/utils/errors";

export const DOT_SHORTEST_DIR_NAME = ".shortest";
export const DOT_SHORTEST_DIR_PATH = path.join(
  process.cwd(),
  DOT_SHORTEST_DIR_NAME,
);
export const CACHE_DIR_PATH = path.join(DOT_SHORTEST_DIR_PATH, "cache");
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  log.setGroup("🧹");
  log.trace("Cleaning up cache", { forcePurge });

  if (!existsSync(dirPath)) {
    log.trace("Cache directory does not exist", { dirPath });
    return;
  }

  if (forcePurge) {
    await fs.rm(dirPath, { recursive: true, force: true });
    log.debug("Cache directory purged", { dirPath });
    return;
  }

  const cacheFiles = await fs.readdir(dirPath);
  log.trace("Found cache files", {
    count: cacheFiles.length,
  });

  for (const cacheFile of cacheFiles) {
    if (!cacheFile.endsWith(".json")) continue;

    const cacheFilePath = path.join(dirPath, cacheFile);
    const cacheDirPath = path.join(dirPath, path.parse(cacheFile).name);

    try {
      const content = await fs.readFile(cacheFilePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry;

      // Check if cache is outdated or orphaned
      const isOutdatedVersion =
        entry.metadata.version < TestRunRepository.VERSION;
      // TODO: Check lineNumber once that is available
      const testFileExists = existsSync(
        path.join(process.cwd(), entry.test.filePath),
      );

      if (isOutdatedVersion || !testFileExists) {
        await fs.unlink(cacheFilePath);
        await fs.rm(cacheDirPath, { recursive: true, force: true });
        log.trace("Cache removed", {
          file: cacheFile,
          reason: isOutdatedVersion
            ? "outdated version"
            : "test file no longer exists",
        });
      }
    } catch (error) {
      log.error("Failed to process cache file", {
        file: cacheFilePath,
        ...getErrorDetails(error),
      });
      await fs.unlink(cacheFilePath);
      await fs.rm(cacheDirPath, { recursive: true, force: true });
      log.error("Invalid cache file removed", { file: cacheFilePath });
    }
  }
  log.trace("Cache clean-up complete");
  log.resetGroup();
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

/**
 * Removes legacy screenshots directory from older versions
 *
 * @private
 */
export const purgeLegacyScreenshots = async () => {
  const log = getLogger();
  const legacyScreenshotsPath = path.join(DOT_SHORTEST_DIR_PATH, "screenshots");

  if (!(await directoryExists(legacyScreenshotsPath))) {
    return;
  }

  log.warn(`Purging legacy screenshots directory: ${legacyScreenshotsPath}`);

  try {
    await fs.rm(legacyScreenshotsPath, { recursive: true, force: true });
    log.debug(`Legacy screenshots directory ${legacyScreenshotsPath} purged`);
  } catch (error) {
    log.error("Failed to purge legacy screenshots directory", {
      path: legacyScreenshotsPath,
      ...getErrorDetails(error),
    });
  }
};
