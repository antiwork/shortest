import * as fs from "fs/promises";
import * as path from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import type { CacheEntry } from "@/types/cache";

vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("@/log", () => ({
  getLogger: vi.fn(() => ({
    setGroup: vi.fn(),
    resetGroup: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("TestRunRepository", () => {
  const TEST_CACHE_DIR = "/test-cache-dir";
  const TEST_IDENTIFIER = "test-identifier";

  let mockTestCase: ReturnType<typeof createTestCase>;
  let repository: TestRunRepository;
  let sampleCacheEntry: CacheEntry;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTestCase = createTestCase({
      name: "Test case",
      filePath: "/test.ts",
    });

    Object.defineProperty(mockTestCase, "identifier", {
      get: () => TEST_IDENTIFIER,
    });

    repository = new TestRunRepository(mockTestCase, TEST_CACHE_DIR);
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);

    sampleCacheEntry = {
      metadata: {
        timestamp: Date.now(),
        version: TestRunRepository.VERSION,
        status: "passed",
        reason: "Test passed",
        tokenUsage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 },
        runId: `run1_${TEST_IDENTIFIER}`,
        executedFromCache: false,
      },
      test: {
        name: mockTestCase.name,
        filePath: mockTestCase.filePath,
      },
      data: {
        steps: [],
      },
    };
  });

  describe("Initialization", () => {
    test("initializes with correct parameters", () => {
      expect(repository["testCase"]).toBe(mockTestCase);
      expect(repository["globalCacheDir"]).toBe(TEST_CACHE_DIR);
      expect(repository["lockFileName"]).toBe(`${TEST_IDENTIFIER}.lock`);
    });

    test("getRepositoryForTestCase returns cached repository for same test case", () => {
      const repo1 = TestRunRepository.getRepositoryForTestCase(mockTestCase);
      const repo2 = TestRunRepository.getRepositoryForTestCase(mockTestCase);

      expect(repo1).toBe(repo2);
    });
  });

  describe("Loading test runs", () => {
    test("loads test runs from cache files", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        `run1_${TEST_IDENTIFIER}.json`,
        `run2_${TEST_IDENTIFIER}.json`,
        "some-other-file.json",
      ] as any);

      const passedCacheEntry = { ...sampleCacheEntry };

      const failedCacheEntry = {
        ...sampleCacheEntry,
        metadata: {
          ...sampleCacheEntry.metadata,
          status: "failed",
          reason: "Test failed",
          tokenUsage: {
            completionTokens: 5,
            promptTokens: 10,
            totalTokens: 15,
          },
          runId: `run2_${TEST_IDENTIFIER}`,
        },
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(passedCacheEntry))
        .mockResolvedValueOnce(JSON.stringify(failedCacheEntry));

      const runs = await repository.getRuns();

      expect(runs).toHaveLength(2);
      expect(runs[0].runId).toBe(`run1_${TEST_IDENTIFIER}`);
      expect(runs[0].status).toBe("passed");
      expect(runs[1].runId).toBe(`run2_${TEST_IDENTIFIER}`);
      expect(runs[1].status).toBe("failed");
    });

    test("handles errors when loading cache files", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        `run1_${TEST_IDENTIFIER}.json`,
        `corrupt_${TEST_IDENTIFIER}.json`,
      ] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(sampleCacheEntry))
        .mockRejectedValueOnce(new Error("Failed to read file"));

      const runs = await repository.getRuns();

      expect(runs).toHaveLength(1);
      expect(runs[0].runId).toBe(`run1_${TEST_IDENTIFIER}`);
    });

    test("caches test runs after loading them", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        `run1_${TEST_IDENTIFIER}.json`,
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify(sampleCacheEntry),
      );

      const firstLoad = await repository.getRuns();
      const secondLoad = await repository.getRuns();

      expect(fs.readdir).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(firstLoad).toBe(secondLoad);
    });
  });

  describe("Managing test runs", () => {
    test("getLatestPassedRun filters runs based on status, version, and executedFromCache flag", async () => {
      // Create 5 test runs with different properties to test all conditions
      const runs = [
        // Run 1: Invalid - wrong version
        TestRun.create(mockTestCase),
        // Run 2: Invalid - failed
        TestRun.create(mockTestCase),
        // Run 3: Invalid - from cache
        TestRun.create(mockTestCase),
        // Run 4: Valid run - first valid
        TestRun.create(mockTestCase),
        // Run 5: Valid run - last valid (this should be returned)
        TestRun.create(mockTestCase),
      ];

      // Configure run 1: Invalid - wrong version
      runs[0].markRunning();
      runs[0].markPassed({ reason: "Invalid - wrong version" });
      Object.defineProperty(runs[0], "timestamp", { value: 5000 });
      Object.defineProperty(runs[0], "version", {
        value: TestRunRepository.VERSION - 1,
      });
      Object.defineProperty(runs[0], "executedFromCache", { value: false });

      // Configure run 2: Invalid - failed
      runs[1].markRunning();
      runs[1].markFailed({ reason: "Invalid - failed status" });
      Object.defineProperty(runs[1], "timestamp", { value: 4000 });
      Object.defineProperty(runs[1], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(runs[1], "executedFromCache", { value: false });

      // Configure run 3: Invalid - from cache
      runs[2].markRunning();
      runs[2].markPassed({ reason: "Invalid - executed from cache" });
      Object.defineProperty(runs[2], "timestamp", { value: 3000 });
      Object.defineProperty(runs[2], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(runs[2], "executedFromCache", { value: true });

      // Configure run 4: Valid - first valid
      runs[3].markRunning();
      runs[3].markPassed({ reason: "Valid run - first" });
      Object.defineProperty(runs[3], "timestamp", { value: 2000 });
      Object.defineProperty(runs[3], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(runs[3], "executedFromCache", { value: false });

      // Configure run 5: Valid - second valid (this should be returned as it's last in array)
      runs[4].markRunning();
      runs[4].markPassed({ reason: "Valid run - last" });
      Object.defineProperty(runs[4], "timestamp", { value: 1000 });
      Object.defineProperty(runs[4], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(runs[4], "executedFromCache", { value: false });

      vi.spyOn(repository, "getRuns").mockResolvedValue(runs);

      const latestRun = await repository.getLatestPassedRun();

      // Should return the last valid run in the array (runs[4])
      expect(latestRun).toBe(runs[4]);

      // Make sure it doesn't return any of the invalid runs
      expect(latestRun).not.toBe(runs[0]); // Wrong version
      expect(latestRun).not.toBe(runs[1]); // Failed status
      expect(latestRun).not.toBe(runs[2]); // Executed from cache
    });

    test("getLatestPassedRun returns null when no valid runs exist", async () => {
      // Create test runs that don't meet requirements
      const invalidRuns = [
        // Run 1: Failed status
        TestRun.create(mockTestCase),
        // Run 2: Executed from cache
        TestRun.create(mockTestCase),
        // Run 3: Wrong version
        TestRun.create(mockTestCase),
      ];

      // Configure run 1: Failed status
      invalidRuns[0].markRunning();
      invalidRuns[0].markFailed({ reason: "Failed run" });
      Object.defineProperty(invalidRuns[0], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(invalidRuns[0], "executedFromCache", {
        value: false,
      });

      // Configure run 2: Executed from cache
      invalidRuns[1].markRunning();
      invalidRuns[1].markPassed({ reason: "Cached run" });
      Object.defineProperty(invalidRuns[1], "version", {
        value: TestRunRepository.VERSION,
      });
      Object.defineProperty(invalidRuns[1], "executedFromCache", {
        value: true,
      });

      // Configure run 3: Wrong version
      invalidRuns[2].markRunning();
      invalidRuns[2].markPassed({ reason: "Wrong version run" });
      Object.defineProperty(invalidRuns[2], "version", {
        value: TestRunRepository.VERSION - 1,
      });
      Object.defineProperty(invalidRuns[2], "executedFromCache", {
        value: false,
      });

      vi.spyOn(repository, "getRuns").mockResolvedValue(invalidRuns);

      const latestRun = await repository.getLatestPassedRun();

      // Should return null as no run meets all requirements
      expect(latestRun).toBeNull();
    });

    test("saveRun writes a test run to the cache file", async () => {
      vi.spyOn(repository as any, "acquireLock").mockResolvedValue(true);
      vi.spyOn(repository, "releaseLock").mockResolvedValue();

      const expectedFilePath = path.join(TEST_CACHE_DIR, "test-run-id.json");
      vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
        expectedFilePath,
      );

      const testRun = TestRun.create(mockTestCase);
      testRun.markRunning();
      testRun.markPassed({ reason: "Test passed" });

      await repository.saveRun(testRun);

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedFilePath,
        expect.any(String),
        "utf-8",
      );

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      expect(writtenContent).toMatchObject({
        metadata: {
          version: TestRunRepository.VERSION,
          status: "passed",
          reason: "Test passed",
        },
        test: {
          name: mockTestCase.name,
          filePath: mockTestCase.filePath,
        },
      });
    });

    test("saveRun does nothing if lock acquisition fails", async () => {
      vi.spyOn(repository as any, "acquireLock").mockResolvedValue(false);

      const testRun = TestRun.create(mockTestCase);
      testRun.markRunning();
      testRun.markPassed({ reason: "Test passed" });

      await repository.saveRun(testRun);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test("deleteRun removes a test run's files", async () => {
      const testRun = TestRun.create(mockTestCase);
      testRun.markRunning();
      testRun.markPassed({ reason: "Test passed" });

      const cacheFilePath = path.join(TEST_CACHE_DIR, "test-run-id.json");
      const cacheDirPath = path.join(TEST_CACHE_DIR, "test-run-id");

      vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
        cacheFilePath,
      );
      vi.spyOn(repository as any, "getTestRunDirPath").mockReturnValue(
        cacheDirPath,
      );

      await repository.deleteRun(testRun);

      expect(fs.unlink).toHaveBeenCalledWith(cacheFilePath);
      expect(fs.rm).toHaveBeenCalledWith(cacheDirPath, {
        recursive: true,
        force: true,
      });
    });

    test("handles errors when deleting non-existent files", async () => {
      const testRun = TestRun.create(mockTestCase);
      testRun.markRunning();
      testRun.markPassed({ reason: "Test passed" });

      vi.mocked(fs.unlink).mockRejectedValue(new Error("File not found"));
      vi.mocked(fs.rm).mockRejectedValue(new Error("Directory not found"));

      await expect(repository.deleteRun(testRun)).resolves.not.toThrow();
    });
  });

  describe("Retention policy", () => {
    test("deletes runs with outdated version", async () => {
      const deleteRunMock = vi.fn().mockResolvedValue(undefined);
      repository.deleteRun = deleteRunMock;

      const outdatedRun = { version: TestRunRepository.VERSION - 1 } as TestRun;
      const currentRun = {
        version: TestRunRepository.VERSION,
        status: "passed",
        runId: "current-run",
        executedFromCache: false,
      } as TestRun;

      vi.spyOn(repository, "getRuns").mockResolvedValue([
        outdatedRun,
        currentRun,
      ]);
      vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue(currentRun);

      await repository.applyRetentionPolicy();

      expect(deleteRunMock).toHaveBeenCalledWith(outdatedRun);
    });

    test("keeps only latest passed run when one exists", async () => {
      const deleteRunMock = vi.fn().mockResolvedValue(undefined);
      repository.deleteRun = deleteRunMock;

      const passedRun = {
        version: TestRunRepository.VERSION,
        status: "passed",
        runId: "passed-run",
        executedFromCache: false,
      } as TestRun;
      const failedRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "failed-run",
        executedFromCache: false,
      } as TestRun;

      vi.spyOn(repository, "getRuns").mockResolvedValue([passedRun, failedRun]);
      vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue(passedRun);

      await repository.applyRetentionPolicy();

      expect(deleteRunMock).toHaveBeenCalledWith(failedRun);
      expect(deleteRunMock).not.toHaveBeenCalledWith(passedRun);
    });

    test("keeps most recent run when no passed runs exist", async () => {
      const deleteRunMock = vi.fn().mockResolvedValue(undefined);
      repository.deleteRun = deleteRunMock;

      const olderRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "older-run",
        timestamp: 1000,
        executedFromCache: false,
      } as TestRun;
      const newerRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "newer-run",
        timestamp: 2000,
        executedFromCache: false,
      } as TestRun;

      vi.spyOn(repository, "getRuns").mockResolvedValue([olderRun, newerRun]);
      vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue(null);

      await repository.applyRetentionPolicy();

      expect(deleteRunMock).toHaveBeenCalledWith(olderRun);
      expect(deleteRunMock).not.toHaveBeenCalledWith(newerRun);
    });

    test("excludes runs with executedFromCache=true from retention policy", async () => {
      const deleteRunMock = vi.fn().mockResolvedValue(undefined);
      repository.deleteRun = deleteRunMock;

      const fromCacheRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "from-cache-run",
        timestamp: 3000,
        executedFromCache: true,
      } as TestRun;
      const regularRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "regular-run",
        timestamp: 2000,
        executedFromCache: false,
      } as TestRun;
      const olderRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "older-run",
        timestamp: 1000,
        executedFromCache: false,
      } as TestRun;

      vi.spyOn(repository, "getRuns").mockResolvedValue([
        fromCacheRun,
        regularRun,
        olderRun,
      ]);
      vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue(null);

      await repository.applyRetentionPolicy();

      // fromCacheRun should be excluded from consideration due to executedFromCache=true
      // regularRun should be kept as the most recent non-cache run
      // olderRun should be deleted
      expect(deleteRunMock).toHaveBeenCalledWith(olderRun);
      expect(deleteRunMock).not.toHaveBeenCalledWith(regularRun);
      expect(deleteRunMock).not.toHaveBeenCalledWith(fromCacheRun);
    });
  });

  describe("Directory management", () => {
    test("ensureTestRunDirPath creates run directory if it doesn't exist", async () => {
      const testRun = TestRun.create(mockTestCase);
      const expectedPath = path.join(TEST_CACHE_DIR, testRun.runId);

      await repository.ensureTestRunDirPath(testRun);

      expect(fs.mkdir).toHaveBeenCalledWith(expectedPath, { recursive: true });
    });
  });
});
