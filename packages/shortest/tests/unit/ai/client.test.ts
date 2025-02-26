import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIClient } from "@/ai/client";
import { BrowserTool } from "@/browser/core/browser-tool";
import { TestCache } from "@/cache/test-cache";
import { TokenUsage } from "@/types/ai";
import { ActionInput, ToolResult } from "@/types/browser";
import { CacheEntry } from "@/types/cache";
import { AIError } from "@/utils/errors";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  NoSuchToolError: {
    isInstance: (e: unknown) =>
      e instanceof Error && e.name === "NoSuchToolError",
  },
  InvalidToolArgumentsError: {
    isInstance: (e: unknown) =>
      e instanceof Error && e.name === "InvalidToolArgumentsError",
  },
}));

vi.mock("@/utils/sleep", () => ({
  sleep: () => Promise.resolve(),
}));

vi.mock("@/index", () => ({
  getConfig: () => ({
    ai: {
      provider: "anthropic",
      apiKey: "test-key",
    },
  }),
}));

vi.mock("@/ai/provider", () => ({
  createProvider: () => ({
    name: "test-provider",
  }),
}));

vi.mock("@/ai/prompts", () => ({
  SYSTEM_PROMPT: "test system prompt",
}));

describe("AIClient", () => {
  let client: AIClient;
  let browserTool: BrowserTool;
  let cache: TestCache;

  const createMockResponse = (
    text: string,
    finishReason: string,
    usage: TokenUsage = {
      completionTokens: 10,
      promptTokens: 20,
      totalTokens: 30,
    },
  ) => ({
    text,
    finishReason,
    usage,
    response: { messages: [] },
    toolCalls: [],
    toolResults: [],
    warnings: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    browserTool = {
      execute: vi.fn<[ActionInput], Promise<ToolResult>>(),
      getNormalizedComponentStringByCoords: vi.fn<
        [number, number],
        Promise<string>
      >(),
    } as Pick<
      BrowserTool,
      "execute" | "getNormalizedComponentStringByCoords"
    > as BrowserTool;

    cache = {
      set: vi.fn<[], Promise<void>>(),
      get: vi.fn<[], Promise<CacheEntry | null>>(),
    } as Pick<TestCache, "set" | "get"> as TestCache;

    Object.defineProperty(AIClient.prototype, "tools", {
      get: () => ({
        test_tool: {
          description: "Test tool",
          execute: vi.fn(),
        },
      }),
    });

    vi.spyOn(
      AIClient.prototype as any,
      "isNonRetryableError",
    ).mockImplementation(
      (error: unknown) =>
        error instanceof AIError ||
        (error instanceof Error &&
          (error as { status?: number }).status === 401),
    );

    client = new AIClient({
      browserTool,
      testCache: cache,
    });
    (client as any).testCache = cache;
  });

  describe("runAction", () => {
    it("successfully processes an action with valid response", async () => {
      const mockResponse = createMockResponse(
        '{"status": "passed", "reason": "test passed"}',
        "stop",
      );

      (generateText as any).mockResolvedValue(mockResponse);

      const result = await client.runAction("test prompt");

      expect(result).toEqual({
        response: {
          status: "passed",
          reason: "test passed",
        },
        metadata: {
          usage: mockResponse.usage,
        },
      });
      expect(cache.set).toHaveBeenCalled();
    });

    it("handles tool calls and continues conversation", async () => {
      const toolCallResponse = {
        text: "Using tool",
        finishReason: "tool-calls",
        usage: { completionTokens: 5, promptTokens: 10, totalTokens: 15 },
        response: { messages: [{ role: "assistant", content: "Using tool" }] },
        toolCalls: [
          {
            toolName: "navigate",
            args: { action: "navigate", url: "https://example.com" },
          },
        ],
        toolResults: [
          { toolName: "navigate", result: { output: "Navigated" } },
        ],
        warnings: [],
      };

      const finalResponse = createMockResponse(
        '{"status": "passed", "reason": "test completed"}',
        "stop",
      );

      (generateText as any)
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await client.runAction("test prompt");

      expect(result.response).toEqual({
        status: "passed",
        reason: "test completed",
      });
      expect(cache.set).toHaveBeenCalled();
    });

    describe("error handling", () => {
      it("retries on retryable errors", async () => {
        const error = new Error("Network error");
        const successResponse = createMockResponse(
          '{"status": "passed", "reason": "test passed"}',
          "stop",
        );

        (generateText as any)
          .mockRejectedValueOnce(error)
          .mockResolvedValue(successResponse);

        const result = await client.runAction("test prompt");

        expect(result.response).toEqual({
          status: "passed",
          reason: "test passed",
        });
      });

      it.each([
        {
          name: "non-retryable error",
          error: Object.assign(new Error("Unauthorized"), { status: 401 }),
          expectedMessage: "Unauthorized",
          expectedInstance: Error,
        },
        {
          name: "max retries",
          error: new Error("Network error"),
          expectedMessage: "Max retries reached",
          expectedInstance: AIError,
        },
      ])(
        "handles $name",
        async ({ error, expectedMessage, expectedInstance }) => {
          (generateText as any).mockRejectedValue(error);

          await expect(async () => {
            await client.runAction("test prompt");
          }).rejects.toSatisfy((value: unknown) => {
            const e = value as Error;
            expect(e).toBeInstanceOf(expectedInstance);
            expect(e.message).toBe(expectedMessage);
            return true;
          });
        },
      );

      it.each([
        {
          name: "content filter violation",
          finishReason: "content-filter",
          expectedMessage: "Content filter violation: generation aborted.",
          expectedType: "unsafe-content-detected",
        },
        {
          name: "token limit exceeded",
          finishReason: "length",
          expectedMessage:
            "Generation stopped because the maximum token length was reached.",
          expectedType: "token-limit-exceeded",
        },
        {
          name: "unknown error",
          finishReason: "error",
          expectedMessage: "An error occurred during generation.",
          expectedType: "unknown",
        },
      ])(
        "handles $name",
        async ({ finishReason, expectedMessage, expectedType }) => {
          const response = createMockResponse("", finishReason);
          (generateText as any).mockResolvedValue(response);

          await expect(client.runAction("test prompt")).rejects.toMatchObject({
            message: expectedMessage,
            name: "ShortestError",
            type: expectedType,
          });
        },
      );

      it("handles max retries", async () => {
        const error = new Error("Network error");
        (generateText as any)
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error);

        await expect(client.runAction("test prompt")).rejects.toMatchObject({
          message: "Max retries reached",
          name: "AIError",
          type: "max-retries-reached",
        });
      });
    });
  });
});
