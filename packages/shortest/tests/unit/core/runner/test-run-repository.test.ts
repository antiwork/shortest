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
        fromCache: false,
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
    test("getLatestPassedRun returns the most recent passed run", async () => {
      const olderRun = new TestRun(mockTestCase);
      olderRun.markRunning();
      olderRun.markPassed({ reason: "First test passed" });
      Object.defineProperty(olderRun, "timestamp", { value: 1000 });

      const newerRun = new TestRun(mockTestCase);
      newerRun.markRunning();
      newerRun.markPassed({ reason: "Second test passed" });
      Object.defineProperty(newerRun, "timestamp", { value: 2000 });

      vi.spyOn(repository, "getRuns").mockResolvedValue([olderRun, newerRun]);

      const latestRun = await repository.getLatestPassedRun();

      expect(latestRun).toBe(newerRun);
    });

    test("saveRun writes a test run to the cache file", async () => {
      vi.spyOn(repository as any, "acquireLock").mockResolvedValue(true);
      vi.spyOn(repository, "releaseLock").mockResolvedValue();

      const expectedFilePath = path.join(TEST_CACHE_DIR, "test-run-id.json");
      vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
        expectedFilePath,
      );

      const testRun = new TestRun(mockTestCase);
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

      const testRun = new TestRun(mockTestCase);
      testRun.markRunning();
      testRun.markPassed({ reason: "Test passed" });

      await repository.saveRun(testRun);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test("deleteRun removes a test run's files", async () => {
      const testRun = new TestRun(mockTestCase);
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
      const testRun = new TestRun(mockTestCase);
      const cacheFilePath = path.join(TEST_CACHE_DIR, "test-run-id.json");
      const cacheDirPath = path.join(TEST_CACHE_DIR, "test-run-id");

      vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
        cacheFilePath,
      );
      vi.spyOn(repository as any, "getTestRunDirPath").mockReturnValue(
        cacheDirPath,
      );

      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error("ENOENT"));
      vi.mocked(fs.rm).mockRejectedValueOnce(new Error("Directory not found"));

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
      } as TestRun;
      const failedRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "failed-run",
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
      } as TestRun;
      const newerRun = {
        version: TestRunRepository.VERSION,
        status: "failed",
        runId: "newer-run",
        timestamp: 2000,
      } as TestRun;

      vi.spyOn(repository, "getRuns").mockResolvedValue([olderRun, newerRun]);
      vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue(null);

      await repository.applyRetentionPolicy();

      expect(deleteRunMock).toHaveBeenCalledWith(olderRun);
      expect(deleteRunMock).not.toHaveBeenCalledWith(newerRun);
    });
  });

  describe("Directory management", () => {
    test("ensureTestRunDirPath creates run directory if it doesn't exist", async () => {
      const testRun = new TestRun(mockTestCase);
      const expectedDirPath = path.join(TEST_CACHE_DIR, testRun.runId);

      const dirPath = await repository.ensureTestRunDirPath(testRun);

      expect(dirPath).toBe(expectedDirPath);
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDirPath, {
        recursive: true,
      });
    });
  });
});
