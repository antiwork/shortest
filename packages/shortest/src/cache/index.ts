import * as fs from "fs/promises";
import path, { join } from "path";
import { TestCache } from "@/cache/test-cache";
import { getLogger } from "@/log";
import { CacheEntry } from "@/types/cache";
import { directoryExists } from "@/utils/directory-exists";
import { getErrorDetails } from "@/utils/errors";

export { TestCache };

export const DOT_SHORTEST_DIR_NAME = ".shortest";
export const DOT_SHORTEST_DIR_PATH = path.join(
  process.cwd(),
  DOT_SHORTEST_DIR_NAME,
);
export const CACHE_DIR_PATH = path.join(DOT_SHORTEST_DIR_PATH, "cache");

export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS_FOR_SCREENSHOTS = 5 * 60 * 60 * 1000;
const MAX_SCREENSHOTS = 10;

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

  if (!(await directoryExists(dirPath))) {
    log.debug("Cache directory does not exist", { dirPath });
    return;
  }

  await cleanupJson(dirPath, forcePurge);

  await cleanupScreenshots(dirPath, forcePurge);
};

const cleanupJson = async (
  dirPath: string,
  forcePurge: boolean,
): Promise<void> => {
  const log = getLogger();
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
 * Cleans up screenshot files in the specified directory
 *
 * @param directory The directory containing screenshots
 */
const cleanupScreenshots = async (
  directory: string,
  forcePurge: boolean,
): Promise<void> => {
  const log = getLogger();
  let counter = 0;

  try {
    if (!(await directoryExists(directory))) return;

    const dirEntries = await fs.readdir(directory, { withFileTypes: true });
    const directories = await Promise.all(
      dirEntries
        .filter((dirent) => dirent.isDirectory())
        .map(async (dirent) => {
          const dirPath = join(directory, dirent.name);
          const stats = await fs.stat(dirPath);
          return {
            name: dirent.name,
            path: dirPath,
            time: stats.mtime.getTime(),
          };
        }),
    );

    directories.sort((a, b) => b.time - a.time);

    for (const dir of directories) {
      const fileEntries = await fs.readdir(join(directory, dir.name));
      const fileStats = await Promise.all(
        fileEntries
          .filter((file) => file.endsWith(".png") || file.endsWith(".jpg"))
          .map(async (file) => {
            const filePath = join(directory, dir.name, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              time: stats.mtime.getTime(),
            };
          }),
      );

      fileStats.sort((a, b) => b.time - a.time);

      const now = Date.now();

      for (const file of fileStats) {
        counter++;
        const isOld = now - file.time > MAX_AGE_MS_FOR_SCREENSHOTS;
        const isBeyondLimit = counter > MAX_SCREENSHOTS;

        if (forcePurge || isOld || isBeyondLimit) {
          try {
            if (isBeyondLimit) {
              console.log("Removing screenshot", { file: file.path });
            }
            await fs.unlink(file.path);
            const dirPath = path.join(directory, dir.name);
            const remainingFiles = await fs.readdir(dirPath);
            if (remainingFiles.length === 0) {
              await fs.rmdir(dirPath);
            }
            log.trace("Screenshot removed", { file: file.path });
          } catch (error: unknown) {
            log.error("Failed to delete screenshot", getErrorDetails(error));
          }
        }
      }
    }
  } catch (error) {
    log.error(
      "Failed to clean up screenshots directory",
      getErrorDetails(error),
    );
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

  if (!(await directoryExists(legacyCachePath))) {
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
 * @param {{ dirPath?: string }} options - Cleanup options where dirPath is the path to the SHORTEST_DIR_NAME directory
 * @private
 */
export const purgeLegacyScreenshots = async () => {
  const log = getLogger();
  const legacyScreenshotsPath = path.join(CACHE_DIR_PATH, "screenshots");

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
