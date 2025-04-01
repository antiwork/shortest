import { describe, expect, it, vi, beforeEach } from "vitest";
import { getGitInfo } from "@/utils/get-git-info";

const mockBranch = vi.fn();
const mockRevparse = vi.fn();
const mockGitInstance = {
  branch: mockBranch,
  revparse: mockRevparse,
};

vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => mockGitInstance),
}));

const mockLoggerError = vi.fn();
vi.mock("@/log", () => ({
  getLogger: vi.fn(() => ({
    error: mockLoggerError,
  })),
}));

vi.mock("@/utils/errors", () => ({
  getErrorDetails: vi.fn((error: unknown) => error),
}));

describe("getGitInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns branch and commit information when git operations succeed", async () => {
    mockBranch.mockResolvedValue({ current: "main" });
    mockRevparse.mockResolvedValue("abc1234");

    const result = await getGitInfo();

    expect(mockBranch).toHaveBeenCalled();
    expect(mockRevparse).toHaveBeenCalledWith(["HEAD"]);

    expect(result).toEqual({
      branch: "main",
      commit: "abc1234",
    });

    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("returns null values when git operations fail", async () => {
    const gitError = new Error("Git error");
    mockBranch.mockRejectedValue(gitError);

    const result = await getGitInfo();

    expect(result).toEqual({
      branch: null,
      commit: null,
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to get git info",
      gitError,
    );
  });
});
