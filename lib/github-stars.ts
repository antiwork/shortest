"use server";

import { Octokit } from "@octokit/rest";

let cachedStarCount: number | null = null;
let cacheTime: number | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const getGitHubStarCount = async () => {
  if (cachedStarCount !== null && cacheTime !== null) {
    const now = Date.now();
    if (now - cacheTime < CACHE_DURATION) {
      return cachedStarCount.toLocaleString();
    }
  }

  try {
    const octokit = new Octokit();
    const { data } = await octokit.repos.get({
      owner: "antiwork",
      repo: "shortest",
    });

    cachedStarCount = data.stargazers_count;
    cacheTime = Date.now();

    return cachedStarCount.toLocaleString();
  } catch (error) {
    console.error("Error fetching GitHub star count:", error);
    return (cachedStarCount || 0).toLocaleString();
  }
};
