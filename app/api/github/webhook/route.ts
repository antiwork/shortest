import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse webhook payload:", error);
    return NextResponse.json(
      { error: "Failed to parse webhook payload" },
      { status: 500 },
    );
  }

  const githubEvent = request.headers.get("x-github-event");

  if (!githubEvent) {
    return NextResponse.json(
      { error: "No GitHub event specified" },
      { status: 400 },
    );
  }

  try {
    switch (githubEvent) {
      case "push":
        await handlePushEvent(payload);
        break;
      case "pull_request":
        await handlePullRequestEvent(payload);
        break;
      case "check_run":
        await handleCheckRunEvent(payload);
        break;
      case "check_suite":
        await handleCheckSuiteEvent(payload);
        break;
      default:
        console.log(`Unhandled event type: ${githubEvent}`);
    }

    return NextResponse.json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error(`Error processing ${githubEvent} webhook:`, error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
};

const handlePushEvent = (payload: any) => {
  const { repository } = payload;
  console.log(`New push to ${repository.full_name}`);
};

const handlePullRequestEvent = (payload: any) => {
  const { action, pull_request, repository } = payload;
  console.log(`Pull request ${action} in ${repository.full_name}`);
  revalidateTag(`pullRequest-${pull_request.id}`);
};

const handleCheckRunEvent = (payload: any) => {
  const { action, check_run, repository } = payload;
  console.log(`Check run ${action} in ${repository.full_name}`);
  if (check_run.pull_requests && check_run.pull_requests.length > 0) {
    check_run.pull_requests.forEach((pr: any) => {
      revalidateTag(`pullRequest-${pr.id}`);
    });
  }
};

const handleCheckSuiteEvent = (payload: any) => {
  const { action, check_suite, repository } = payload;
  console.log(`Check suite ${action} in ${repository.full_name}`);
  if (check_suite.pull_requests && check_suite.pull_requests.length > 0) {
    check_suite.pull_requests.forEach((pr: any) => {
      revalidateTag(`pullRequest-${pr.id}`);
    });
  }
};
