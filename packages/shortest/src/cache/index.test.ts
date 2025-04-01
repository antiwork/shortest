import { existsSync } from "fs";
import * as fs from "fs/promises";
import path from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanUpCache } from "@/cache";
import { TestRunRepository } from "@/core/runner/test-run-repository";
import { CacheEntry } from "@/types/cache";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  Dirent: class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    isFile() {
      return true;
    }
    isDirectory() {
      return false;
    }
  },
}));

vi.mock("fs/promises", () => ({
  readdir: vi.fn<[], Promise<string[]>>(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
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

describe("cleanUpCache", () => {
  const TEST_CACHE_DIR = "/test-cache-dir";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early if cache directory does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await cleanUpCache({ dirPath: TEST_CACHE_DIR });

    expect(fs.readdir).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it("should purge entire cache directory when forcePurge is true", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    await cleanUpCache({ forcePurge: true, dirPath: TEST_CACHE_DIR });

    expect(fs.rm).toHaveBeenCalledWith(TEST_CACHE_DIR, {
      recursive: true,
      force: true,
    });
    expect(fs.readdir).not.toHaveBeenCalled();
  });

  it("should process cache files and remove outdated ones", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(fs.readdir).mockResolvedValue([
      "test1.json",
      "test2.json",
      "not-json-file.txt",
    ] as any);

    const outdatedEntry: CacheEntry = {
      metadata: {
        timestamp: Date.now(),
        version: TestRunRepository.VERSION - 1,
        status: "passed",
        reason: undefined,
        tokenUsage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 },
        runId: "test1",
        executedFromCache: false,
      },
      test: {
        name: "Test 1",
        filePath: "/test1.ts",
      },
      data: {},
    };

    const validEntry: CacheEntry = {
      metadata: {
        timestamp: Date.now(),
        version: TestRunRepository.VERSION,
        status: "passed",
        reason: undefined,
        tokenUsage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 },
        runId: "test2",
        executedFromCache: false,
      },
      test: {
        name: "Test 2",
        filePath: "/test2.ts",
      },
      data: {},
    };

    vi.mocked(existsSync)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(outdatedEntry))
      .mockResolvedValueOnce(JSON.stringify(validEntry));

    await cleanUpCache({ dirPath: TEST_CACHE_DIR });

    expect(fs.readdir).toHaveBeenCalledWith(TEST_CACHE_DIR);
    expect(fs.readFile).toHaveBeenCalledTimes(2);

    expect(fs.unlink).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test1.json"),
    );
    expect(fs.rm).toHaveBeenCalledWith(path.join(TEST_CACHE_DIR, "test1"), {
      recursive: true,
      force: true,
    });

    expect(fs.unlink).not.toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test2.json"),
    );
    expect(fs.rm).not.toHaveBeenCalledWith(path.join(TEST_CACHE_DIR, "test2"), {
      recursive: true,
      force: true,
    });
  });

  it("should remove cache files when test file no longer exists", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(fs.readdir).mockResolvedValue(["test1.json"] as any);

    const validVersionButMissingTestFile: CacheEntry = {
      metadata: {
        timestamp: Date.now(),
        version: TestRunRepository.VERSION,
        status: "passed",
        reason: undefined,
        tokenUsage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 },
        runId: "test1",
        executedFromCache: false,
      },
      test: {
        name: "Test 1",
        filePath: "/test1.ts",
      },
      data: {},
    };

    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);

    vi.mocked(fs.readFile).mockResolvedValueOnce(
      JSON.stringify(validVersionButMissingTestFile),
    );

    await cleanUpCache({ dirPath: TEST_CACHE_DIR });

    expect(fs.readdir).toHaveBeenCalledWith(TEST_CACHE_DIR);
    expect(fs.readFile).toHaveBeenCalledTimes(1);

    expect(fs.unlink).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "test1.json"),
    );
    expect(fs.rm).toHaveBeenCalledWith(path.join(TEST_CACHE_DIR, "test1"), {
      recursive: true,
      force: true,
    });
  });

  it("should handle and remove invalid cache files", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(fs.readdir).mockResolvedValue(["invalid.json"] as any);

    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("Invalid JSON"));

    await cleanUpCache({ dirPath: TEST_CACHE_DIR });

    expect(fs.readdir).toHaveBeenCalledWith(TEST_CACHE_DIR);
    expect(fs.readFile).toHaveBeenCalledTimes(1);

    expect(fs.unlink).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, "invalid.json"),
    );
    expect(fs.rm).toHaveBeenCalledWith(path.join(TEST_CACHE_DIR, "invalid"), {
      recursive: true,
      force: true,
    });
  });
});
