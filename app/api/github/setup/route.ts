import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrUpdateProject } from "@/lib/db/queries";
import { getOctokit } from "@/lib/github";

const SetupRequestSchema = z.object({
  repoFullName: z.string(),
  testPattern: z.string(),
  triggers: z.object({
    onPush: z.boolean(),
    onPullRequest: z.boolean(),
  }),
  defaultBranch: z.string(),
});

type SetupRequest = z.infer<typeof SetupRequestSchema>;

const getFileSHA = async (
  octokit: Awaited<ReturnType<typeof getOctokit>>,
  owner: string,
  repo: string,
  path: string,
  branch: string,
) => {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(response.data)) {
      return null;
    }

    return "sha" in response.data ? response.data.sha : null;
  } catch {
    return null;
  }
};

const createOrUpdateFile = async (
  octokit: Awaited<ReturnType<typeof getOctokit>>,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
) => {
  try {
    const sha = await getFileSHA(octokit, owner, repo, path, branch);
    const params = {
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    };

    await octokit.rest.repos.createOrUpdateFileContents(params);
    return { success: true };
  } catch (error: any) {
    if (error.status === 409) {
      throw new Error(`Conflict while updating ${path}. Please try again.`);
    }
    if (error.status === 422) {
      throw new Error(
        `Validation failed for ${path}. Please check file content and permissions.`,
      );
    }
    if (error.status === 404) {
      throw new Error(`Path ${path} not found or insufficient permissions.`);
    }
    throw error;
  }
};

const createBranch = async (
  octokit: Awaited<ReturnType<typeof getOctokit>>,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranchName: string,
) => {
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    const sha = ref.object.sha;

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha,
    });

    return { success: true, branchName: newBranchName };
  } catch (error: any) {
    if (error.status === 422) {
      throw new Error(`Branch ${newBranchName} already exists.`);
    }
    throw error;
  }
};

const createPullRequest = async (
  octokit: Awaited<ReturnType<typeof getOctokit>>,
  owner: string,
  repo: string,
  baseBranch: string,
  headBranch: string,
  title: string,
  body: string,
) => {
  try {
    const { data: pullRequest } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    return {
      success: true,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url,
    };
  } catch (error) {
    console.error("Error creating pull request:", error);
    throw error;
  }
};

export const POST = async (request: NextRequest) => {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const octokit = await getOctokit();
    const body = await request.json();

    const validatedData = SetupRequestSchema.parse(body) satisfies SetupRequest;
    const { repoFullName, testPattern, triggers, defaultBranch } =
      validatedData;
    const [owner, repo] = repoFullName.split("/");

    try {
      await octokit.rest.repos.get({
        owner,
        repo,
      });
    } catch (error) {
      console.error("Error accessing repository:", error);
      return NextResponse.json(
        {
          error:
            "Repository not found or not accessible. Please make sure the repository exists and you have the right permissions.",
        },
        { status: 404 },
      );
    }

    await createOrUpdateProject({
      owner,
      repo,
    });

    const configContent = `import type { ShortestConfig } from "@antiwork/shortest";

export default {
  headless: false,
  baseUrl: "http://localhost:3000",
  testPattern: '${testPattern}',
  ai: {
    provider: "anthropic",
  },
  caching: {
    enabled: false,
  }
} satisfies ShortestConfig;`;

    const workflowContent = `name: Shortest E2E Tests

on:
${triggers.onPush ? `  push:\n    branches:\n      - ${defaultBranch}\n` : ""}
${triggers.onPullRequest ? "  pull_request:\n" : ""}

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      SHORTEST_ANTHROPIC_API_KEY: \${{ secrets.SHORTEST_ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v2
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm install
      - name: Run Shortest tests
        run: npx shortest run`;

    const branchName = `shortest-setup-${Date.now()}`;

    try {
      await createBranch(octokit, owner, repo, defaultBranch, branchName);

      await createOrUpdateFile(
        octokit,
        owner,
        repo,
        "shortest.config.ts",
        configContent,
        "Add Shortest configuration",
        branchName,
      );

      await createOrUpdateFile(
        octokit,
        owner,
        repo,
        ".github/workflows/shortest.yml",
        workflowContent,
        "Add Shortest workflow",
        branchName,
      );

      const prTitle = "Setup Shortest E2E Testing";
      const prBody = `This PR sets up Shortest E2E testing for your repository.

## Changes:
- Added \`shortest.config.ts\` with your specified test pattern: \`${testPattern}\`
- Added GitHub workflow to run tests ${triggers.onPush ? "on push to " + defaultBranch : ""}${triggers.onPush && triggers.onPullRequest ? " and " : ""}${triggers.onPullRequest ? "on pull requests" : ""}

## Next Steps:
1. Wait for the CI workflow to complete on this PR
2. Review the configuration files and make any necessary adjustments
3. If the CI workflow passes (green check), manually merge this PR to complete the setup
4. If the CI workflow fails, check the logs to identify and fix any issues before merging

Once this PR is merged, Shortest will be ready to use in your repository.`;

      const { pullRequestNumber, pullRequestUrl } = await createPullRequest(
        octokit,
        owner,
        repo,
        defaultBranch,
        branchName,
        prTitle,
        prBody,
      );

      return NextResponse.json({
        message:
          "Setup initiated successfully! A pull request has been created with the Shortest configuration. Please review and merge it after the CI checks pass.",
        pullRequestNumber,
        pullRequestUrl,
        branchName,
      });
    } catch (error) {
      console.error("Error setting up Shortest via PR:", error);
      return NextResponse.json(
        {
          error: "Failed to set up Shortest via PR",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error setting up Shortest:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to set up Shortest",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
