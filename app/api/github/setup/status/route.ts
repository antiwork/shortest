import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPRWorkflowStatus } from "@/lib/github";

const StatusRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pullNumber: z.number(),
});

export const POST = async (request: NextRequest) => {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const body = await request.json();
    const validatedData = StatusRequestSchema.parse(body);
    const { owner, repo, pullNumber } = validatedData;

    const workflowStatus = await getPRWorkflowStatus(owner, repo, pullNumber);

    let message = "";
    switch (workflowStatus.status) {
      case "pending":
        message =
          "The workflow is queued and waiting to run. Please check back later.";
        break;
      case "running":
        message =
          "The workflow is currently running. You can check the logs for progress.";
        break;
      case "success":
        message =
          "The workflow has completed successfully! You can now merge the PR to complete the setup.";
        break;
      case "failure":
        message =
          "The workflow has failed. Please check the logs to identify and fix any issues.";
        break;
    }

    return NextResponse.json({
      ...workflowStatus,
      message,
      pullRequestUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
    });
  } catch (error) {
    console.error("Error checking setup status:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to check setup status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
