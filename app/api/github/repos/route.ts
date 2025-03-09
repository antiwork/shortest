import { NextResponse } from "next/server";
import { getOctokit } from "@/lib/github";

interface Repository {
  full_name: string;
  default_branch: string;
}

const GET = async () => {
  try {
    const octokit = await getOctokit();

    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
    });

    const repositories: Repository[] = repos.map((repo) => ({
      full_name: repo.full_name,
      default_branch: repo.default_branch,
    }));

    return NextResponse.json(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
};

export { GET };
