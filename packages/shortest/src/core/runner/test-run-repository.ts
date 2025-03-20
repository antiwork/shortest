import * as fs from "fs/promises";
import path from "path";
import { CACHE_DIR_PATH } from "@/cache";
import { TestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { getLogger, Log } from "@/log";
import { CacheEntry } from "@/types/cache";
import { getErrorDetails } from "@/utils/errors";

/**
 * Registers shared process handlers for graceful cleanup of test repositories
 *
 * @param {Log} log - Logger instance
 * @returns {Set<TestRunRepository>} Set of active repositories
 * @private
 */
let handlersRegistered = false;
const registerSharedProcessHandlers = (log: Log) => {
  if (handlersRegistered) return TestRunRepository.activeRepositories;

  const activeRepositories = new Set<TestRunRepository>();

  const cleanUpAndExit = async () => {
    await Promise.all(
      [...activeRepositories].map((repo) => repo.releaseLock()),
    );
  };

  process.on("exit", cleanUpAndExit);
  process.on("SIGINT", cleanUpAndExit);
  process.on("SIGTERM", cleanUpAndExit);
  process.on("uncaughtException", async (error) => {
    log.error("Uncaught exception", getErrorDetails(error));
    await cleanUpAndExit();
  });

  handlersRegistered = true;
  return activeRepositories;
};

/**
 * Manages test run persistence, caching, and retention policies
 *
 * This class handles storing and retrieving test runs, managing file locks
 * to prevent concurrent access issues, and applying retention policies to
 * limit disk usage.
 *
 * @class
 * @example
 * ```typescript
 * const repository = TestRunRepository.getRepositoryForTestCase(testCase);
 * const testRun = new TestRun(testCase);
 * await repository.saveRun(testRun);
 * ```
 *
 * @see {@link TestRun} for test run structure
 * @see {@link TestCase} for test case structure
 *
 * @private
 */
export class TestRunRepository {
  public static VERSION = 2;
  public static activeRepositories: Set<TestRunRepository>;
  private static repositoriesByIdentifier = new Map<
    string,
    TestRunRepository
  >();

  /**
   * Gets or creates a repository for the specified test case
   *
   * @param {TestCase} testCase - Test case to get repository for
   * @returns {TestRunRepository} Repository instance
   */
  public static getRepositoryForTestCase(
    testCase: TestCase,
  ): TestRunRepository {
    const key = testCase.identifier;
    if (!TestRunRepository.repositoriesByIdentifier.has(key)) {
      const repository = new TestRunRepository(testCase);
      TestRunRepository.repositoriesByIdentifier.set(key, repository);
    }
    return TestRunRepository.repositoriesByIdentifier.get(key)!;
  }

  private readonly testCase: TestCase;
  private readonly lockFileName: string;
  private readonly globalCacheDir: string;
  private readonly log: Log;
  private readonly MAX_LOCK_ATTEMPTS = 10;
  private readonly BASE_LOCK_DELAY_MS = 10;
  private lockAcquired = false;
  private testRuns: TestRun[] | null = null;

  /**
   * Creates a new test run repository instance
   *
   * @param {TestCase} testCase - Test case to manage runs for
   * @param {string} cacheDir - Directory to store cache files in
   */
  constructor(testCase: TestCase, cacheDir = CACHE_DIR_PATH) {
    this.log = getLogger();
    this.log.trace("Initializing TestRunRepository", {
      identifier: testCase.identifier,
    });
    this.testCase = testCase;
    this.globalCacheDir = cacheDir;
    this.lockFileName = `${this.testCase.identifier}.lock`;

    // Register shared handlers and track this instance
    TestRunRepository.activeRepositories =
      registerSharedProcessHandlers(this.log) ||
      TestRunRepository.activeRepositories;
    TestRunRepository.activeRepositories.add(this);
  }

  private get lockFilePath(): string {
    return path.join(this.globalCacheDir, this.lockFileName);
  }

  /**
   * Gets all test runs for the associated test case
   *
   * @returns {Promise<TestRun[]>} Array of test runs
   */
  async getRuns(): Promise<TestRun[]> {
    if (this.testRuns !== null) {
      return this.testRuns;
    }

    this.log.trace("Getting test runs", {
      identifier: this.testCase.identifier,
    });

    const files = (await fs.readdir(this.globalCacheDir)).filter((f) =>
      f.endsWith(`${this.testCase.identifier}.json`),
    );

    const loadedTestRuns: TestRun[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.globalCacheDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const cacheEntry = JSON.parse(content) as CacheEntry;
        loadedTestRuns.push(TestRun.fromCacheFile(this.testCase, cacheEntry));
      } catch (error) {
        this.log.error("Failed to load test run from cache", {
          file,
          ...getErrorDetails(error),
        });
      }
    }
    this.testRuns = loadedTestRuns;
    return this.testRuns;
  }

  /**
   * Gets the most recent passed test run
   *
   * @returns {Promise<TestRun | null>} Latest passed test run or null if none exists
   */
  async getLatestPassedRun(): Promise<TestRun | null> {
    const testRuns = await this.getRuns();
    const validTestRuns = testRuns.filter(
      (testRun) =>
        testRun.status === "passed" &&
        testRun.version === TestRunRepository.VERSION &&
        !testRun.fromCache,
    );
    return validTestRuns.length > 0
      ? validTestRuns[validTestRuns.length - 1]
      : null;
  }

  /**
   * Saves a test run to the cache
   *
   * @param {TestRun} testRun - Test run to save
   * @returns {Promise<void>}
   */
  async saveRun(testRun: TestRun): Promise<void> {
    if (!(await this.acquireLock())) {
      this.log.error("Failed to acquire lock for saving run");
      return;
    }

    try {
      const cacheEntry: CacheEntry = {
        metadata: {
          timestamp: Date.now(),
          version: TestRunRepository.VERSION,
          status: testRun.status,
          reason: testRun.reason,
          tokenUsage: testRun.tokenUsage,
          runId: testRun.runId,
          fromCache: testRun.fromCache,
        },
        test: {
          name: this.testCase.name,
          filePath: this.testCase.filePath,
        },
        data: {
          steps: testRun.getSteps(),
        },
      };

      await fs.writeFile(
        this.getTestRunFilePath(testRun),
        JSON.stringify(cacheEntry, null, 2),
        "utf-8",
      );
    } finally {
      this.resetTestRuns();
      await this.releaseLock();
    }
  }

  /**
   * Deletes a test run and its associated files
   *
   * @param {TestRun} testRun - Test run to delete
   * @returns {Promise<void>}
   */
  async deleteRun(testRun: TestRun): Promise<void> {
    this.log.trace("Deleting test run", {
      runId: testRun.runId,
    });

    // Cache file is created after the test run is completed
    // so it might not exist if the test run is not persisted
    try {
      await fs.unlink(this.getTestRunFilePath(testRun));
      this.resetTestRuns();
    } catch (error) {
      this.log.trace("Cache file not found", {
        cacheFileName: this.getTestRunFilePath(testRun),
        ...getErrorDetails(error),
      });
    }

    // Screenshots and lock file are created during the test run
    // so they might exist even if the test run failed
    try {
      await fs.rm(this.getTestRunDirPath(testRun), {
        recursive: true,
        force: true,
      });
    } catch (error) {
      this.log.error("Failed to delete cache directory", {
        cacheDirName: this.getTestRunDirPath(testRun),
        ...getErrorDetails(error),
      });
    }
  }

  /**
   * Applies retention policy to limit disk usage
   *
   * Keeps only the latest passed run, or if no passed runs exist,
   * keeps only the most recent run.
   *
   * @returns {Promise<void>}
   */
  async applyRetentionPolicy(): Promise<void> {
    this.log.setGroup("🗑️");
    this.log.trace("Applying test run repository retention policy", {
      identifier: this.testCase.identifier,
    });

    const allRuns = await this.getRuns();
    const latestPassedRun = await this.getLatestPassedRun();
    let deletedCount = 0;

    // First pass: Delete any runs with outdated versions
    for (const run of allRuns) {
      if (run.version < TestRunRepository.VERSION) {
        this.log.trace("Deleting run with outdated version", {
          runId: run.runId,
          version: run.version,
          currentVersion: TestRunRepository.VERSION,
        });
        await this.deleteRun(run);
        deletedCount++;
      }
    }

    // Second pass: Deal with current version runs
    // If we have a passed run, keep only that one
    if (latestPassedRun) {
      for (const run of allRuns) {
        if (
          run.version === TestRunRepository.VERSION &&
          run.runId !== latestPassedRun.runId
        ) {
          this.log.trace("Deleting run (keeping only latest passed)", {
            runId: run.runId,
            status: run.status,
          });
          await this.deleteRun(run);
          deletedCount++;
        }
      }

      this.log.trace("Retention policy applied successfully", {
        keptRunId: latestPassedRun.runId,
        totalDeleted: deletedCount,
      });
    }
    // If no passed run, keep only up to MAX_RUNS_PER_TEST most recent runs
    else {
      const MAX_RUNS_PER_TEST = 1;

      const currentVersionRuns = allRuns.filter(
        (run) => run.version === TestRunRepository.VERSION,
      );

      if (currentVersionRuns.length > 0) {
        // Sort by timestamp (newest first)
        const sortedRuns = [...currentVersionRuns].sort(
          (a, b) => b.timestamp - a.timestamp,
        );

        // Keep the most recent MAX_RUNS_PER_TEST runs
        const runsToKeep = sortedRuns.slice(0, MAX_RUNS_PER_TEST);
        const runIdsToKeep = new Set(runsToKeep.map((run) => run.runId));

        // Delete all except the runs we want to keep
        for (const run of currentVersionRuns) {
          if (!runIdsToKeep.has(run.runId)) {
            this.log.trace("Deleting run (exceeds max runs per test)", {
              runId: run.runId,
              status: run.status,
              maxRuns: MAX_RUNS_PER_TEST,
            });
            await this.deleteRun(run);
            deletedCount++;
          }
        }

        if (runsToKeep.length === 1) {
          this.log.trace("Keeping latest run", {
            keptRunId: runsToKeep[0].runId,
            status: runsToKeep[0].status,
            totalDeleted: deletedCount,
          });
        } else {
          this.log.trace(`Keeping ${runsToKeep.length} most recent runs`, {
            keptRunIds: runsToKeep.map((run) => run.runId),
            totalDeleted: deletedCount,
          });
        }
      }
    }
    this.resetTestRuns();
    this.log.resetGroup();
  }

  /**
   * Releases previously acquired lock
   *
   * @returns {Promise<void>}
   */
  public async releaseLock(): Promise<void> {
    if (this.lockAcquired) {
      try {
        await fs.unlink(this.lockFilePath);
        this.lockAcquired = false;
        TestRunRepository.activeRepositories.delete(this);
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
   * Ensures the test run directory exists and returns its path
   *
   * @param {TestRun} testRun - Test run to ensure directory for
   * @returns {Promise<string>} Path to the test run directory
   */
  public async ensureTestRunDirPath(testRun: TestRun): Promise<string> {
    const runDirPath = path.join(this.globalCacheDir, testRun.runId);
    await fs.mkdir(runDirPath, { recursive: true });
    this.resetTestRuns();
    return runDirPath;
  }

  /**
   * Acquires a lock for cache file access
   *
   * Uses exponential backoff to retry lock acquisition
   *
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
   * Checks if a process is still running
   *
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

  /**
   * Gets the file path for a test run's cache file
   *
   * @param {TestRun} testRun - Test run to get file path for
   * @returns {string} Path to the cache file
   * @private
   */
  private getTestRunFilePath(testRun: TestRun): string {
    return path.join(this.globalCacheDir, `${testRun.runId}.json`);
  }

  /**
   * Gets the directory path for a test run's artifacts
   *
   * @param {TestRun} testRun - Test run to get directory path for
   * @returns {string} Path to the test run directory
   * @private
   */
  private getTestRunDirPath(testRun: TestRun): string {
    return path.join(this.globalCacheDir, testRun.runId);
  }

  /**
   * Resets the cached test runs to force reloading from disk
   *
   * @private
   */
  private resetTestRuns() {
    this.testRuns = null;
  }
}
