import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrUpdateRepositoryConfig } from "@/lib/db/queries";
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

    await createOrUpdateRepositoryConfig({
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
    apiKey: process.env.ANTHROPIC_API_KEY
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
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
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

    try {
      // Create or update files serially to avoid conflicts
      await createOrUpdateFile(
        octokit,
        owner,
        repo,
        "shortest.config.ts",
        configContent,
        "Add Shortest configuration",
        defaultBranch,
      );

      await createOrUpdateFile(
        octokit,
        owner,
        repo,
        ".github/workflows/shortest.yml",
        workflowContent,
        "Add Shortest workflow",
        defaultBranch,
      );

      return NextResponse.json({ message: "Setup complete!" });
    } catch (error) {
      console.error("Error creating files:", error);
      return NextResponse.json(
        {
          error:
            "Failed to create configuration files. Please check repository permissions and try again.",
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
