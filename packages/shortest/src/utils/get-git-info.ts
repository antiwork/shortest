import { simpleGit, SimpleGit, CleanOptions } from "simple-git";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";

export interface GitInfo {
  branch: string | null;
  commit: string | null;
}

/**
 * Get Git repository information
 */
export const getGitInfo = async (): Promise<GitInfo> => {
  const log = getLogger();

  try {
    const git: SimpleGit = simpleGit().clean(CleanOptions.FORCE);
    const branchInfo = await git.branch();
    return {
      branch: branchInfo.current,
      commit: await git.revparse(["HEAD"]),
    };
  } catch (error) {
    log.error("Failed to get git info", getErrorDetails(error));
    return {
      branch: null,
      commit: null,
    };
  }
};
