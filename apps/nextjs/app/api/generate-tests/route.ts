import { anthropic } from "@ai-sdk/anthropic";
import { streamObject } from "ai";
import { GenerateTestsInput, TestFileSchema } from "./schema";

export async function POST(req: Request) {
  const { mode, pr_diff, test_files, test_logs } =
    (await req.json()) as GenerateTestsInput;

  const prompt = `You are an expert software engineer. ${
    mode === "write"
      ? "Write entirely new tests and update relevant existing tests in order to reflect the added/edited/removed functionality."
      : "Update the provided failing test files in order to get the PR build back to passing. I have provided the test logs for the PR build inside <Test Logs> tags. Use them to understand what tests are failing. Update tests to get a passing build."
  }

  PR Diff:
  <PR Diff>
  ${pr_diff}
  </PR Diff>

  ${mode === "update" ? "Failing test files:" : "Existing test files:"}
  <Test Files>
  ${test_files
    .map((file) => `${file.name}\n${file.content ? `: ${file.content}` : ""}`)
    .join("\n")}
  </Test Files>

  ${
    test_logs && test_logs.length > 0
      ? `
  Relevant test logs:
  <Test Logs>
  ${test_logs
    .map((group) => `${group.name}:\n${group.logs.join("\n")}`)
    .join("\n\n")}
  </Test Logs>
  `
      : ""
  }

  Respond with an array of test files with their name being the path to the file and the content being the full contents of the updated test file.`;

  const result = await streamObject({
    model: anthropic("claude-3-5-sonnet-20240620"),
    schema: TestFileSchema,
    prompt,
  });

  return result.toTextStreamResponse();
}
