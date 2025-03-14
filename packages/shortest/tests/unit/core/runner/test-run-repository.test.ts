import * as fs from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestCase } from "@/core/runner/test-case";
import { TestRun } from "@/core/runner/test-run";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { CacheEntry } from "@/types/cache";

vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
  mkdir: vi.fn(),
}));

describe("test-run-repository", () => {
  const TEST_CACHE_DIR = "/test-cache-dir";
  const TEST_IDENTIFIER = "test-identifier";

  let mockTestCase: ReturnType<typeof createTestCase>;
  let repository: TestRunRepository;

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
  });

  test("initializes with correct properties", () => {
    expect(repository["testCase"]).toBe(mockTestCase);
    expect(repository["globalCacheDir"]).toBe(TEST_CACHE_DIR);
    expect(repository["lockFileName"]).toBe(`${TEST_IDENTIFIER}.lock`);
  });

  test("getRepositoryForTestCase returns cached repository for same test case", () => {
    const repo1 = TestRunRepository.getRepositoryForTestCase(mockTestCase);
    const repo2 = TestRunRepository.getRepositoryForTestCase(mockTestCase);

    expect(repo1).toBe(repo2);
  });

  test("getRuns loads test runs from cache files", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      `run1_${TEST_IDENTIFIER}.json`,
      `run2_${TEST_IDENTIFIER}.json`,
      "some-other-file.json",
    ] as any);

    const mockCacheEntry1: CacheEntry = {
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

    const mockCacheEntry2: CacheEntry = {
      metadata: {
        timestamp: Date.now(),
        version: TestRunRepository.VERSION,
        status: "failed",
        reason: "Test failed",
        tokenUsage: { completionTokens: 5, promptTokens: 10, totalTokens: 15 },
        runId: `run2_${TEST_IDENTIFIER}`,
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

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(mockCacheEntry1))
      .mockResolvedValueOnce(JSON.stringify(mockCacheEntry2));

    const runs = await repository.getRuns();

    expect(runs).toHaveLength(2);
    expect(runs[0].runId).toBe(`run1_${TEST_IDENTIFIER}`);
    expect(runs[0].status).toBe("passed");
    expect(runs[1].runId).toBe(`run2_${TEST_IDENTIFIER}`);
    expect(runs[1].status).toBe("failed");
  });

  test("getRuns handles errors when loading cache files", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      `run1_${TEST_IDENTIFIER}.json`,
      `corrupt_${TEST_IDENTIFIER}.json`,
    ] as any);

    const mockCacheEntry: CacheEntry = {
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

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(mockCacheEntry))
      .mockRejectedValueOnce(new Error("Failed to read file"));

    const runs = await repository.getRuns();

    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBe(`run1_${TEST_IDENTIFIER}`);
  });

  test("getLatestPassedRun returns the most recent passed run", async () => {
    const testRun1 = new TestRun(mockTestCase);
    testRun1.markRunning();
    testRun1.markPassed({ reason: "First test passed" });
    Object.defineProperty(testRun1, "timestamp", { value: 1000 });

    const testRun2 = new TestRun(mockTestCase);
    testRun2.markRunning();
    testRun2.markPassed({ reason: "Second test passed" });
    Object.defineProperty(testRun2, "timestamp", { value: 2000 });

    vi.spyOn(repository, "getRuns").mockResolvedValue([testRun1, testRun2]);

    const latestRun = await repository.getLatestPassedRun();

    expect(latestRun).toBe(testRun2);
  });

  test("saveRun writes a test run to the cache file", async () => {
    vi.spyOn(repository as any, "acquireLock").mockResolvedValue(true);
    vi.spyOn(repository, "releaseLock").mockResolvedValue();

    vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
      path.join(TEST_CACHE_DIR, "test-run-id.json"),
    );

    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    testRun.markPassed({ reason: "Test passed" });

    await repository.saveRun(testRun);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test-run-id.json"),
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
      data: {
        steps: [],
      },
    });
  });

  test("deleteRun removes a test run's files", async () => {
    vi.spyOn(repository as any, "getTestRunFilePath").mockReturnValue(
      path.join(TEST_CACHE_DIR, "test-run-id.json")
    );

    vi.spyOn(repository as any, "getTestRunDirPath").mockReturnValue(
      path.join(TEST_CACHE_DIR, "test-run-id")
    );

    const testRun = new TestRun(mockTestCase);
    testRun.markRunning();
    testRun.markPassed({ reason: "Test passed" });

    await repository.deleteRun(testRun);

    expect(fs.unlink).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test-run-id.json"),
    );
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test-run-id"),
      {
        recursive: true,
        force: true,
      },
    );
  });

  test("applyRetentionPolicy deletes runs based on policy", async () => {
    const deleteRunMock = vi.fn().mockResolvedValue(undefined);
    repository.deleteRun = deleteRunMock;

    vi.spyOn(repository, "getRuns").mockResolvedValue([
      { version: TestRunRepository.VERSION - 1 } as TestRun, // outdated version
      {
        version: TestRunRepository.VERSION,
        status: "passed",
        runId: "latest",
      } as TestRun, // keep this one
      { version: TestRunRepository.VERSION, status: "failed" } as TestRun, // should be deleted
    ]);

    vi.spyOn(repository, "getLatestPassedRun").mockResolvedValue({
      version: TestRunRepository.VERSION,
      status: "passed",
      runId: "latest",
    } as TestRun);

    await repository.applyRetentionPolicy();

    expect(deleteRunMock).toHaveBeenCalledTimes(2);
  });

  test("ensureTestRunDirPath creates run directory if it doesn't exist", async () => {
    const testRun = new TestRun(mockTestCase);
    const expectedDirPath = path.join(TEST_CACHE_DIR, testRun.runId);

    const dirPath = await repository.ensureTestRunDirPath(testRun);

    expect(dirPath).toBe(expectedDirPath);
    expect(fs.mkdir).toHaveBeenCalledWith(expectedDirPath, { recursive: true });
  });
});
