import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIClient } from "@/ai/client";
import { BrowserTool } from "@/browser/core/browser-tool";
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

vi.mock("@/ai/utils/json", () => ({
  extractJsonPayload: vi.fn().mockImplementation((text) => {
    if (
      text.includes('"status": "passed"') ||
      text.includes('"status":"passed"')
    ) {
      return { status: "passed", reason: "test passed" };
    }
    throw new Error("Invalid JSON");
  }),
}));

describe("AIClient", () => {
  let client: AIClient;
  let browserTool: BrowserTool;
  let testRun: any;

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

    testRun = {
      cache: {
        set: vi.fn<[], Promise<void>>(),
        get: vi.fn<[], Promise<CacheEntry | null>>(),
      },
      testCase: { id: "test-case-id" },
      addStep: vi.fn(),
    };

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
      testRun,
    });
  });

  describe("runAction", () => {
    it("successfully processes an action with valid response", async () => {
      const mockResponse = {
        response: { status: "passed", reason: "test passed" },
        metadata: {
          usage: {
            completionTokens: 10,
            promptTokens: 20,
            totalTokens: 30,
          },
        },
      };

      vi.spyOn(client as any, "runConversation").mockResolvedValue(
        mockResponse,
      );

      const result = await client.runAction("test prompt");

      expect(result).toEqual(mockResponse);
      expect(testRun.cache.set).not.toHaveBeenCalled(); // Cache is handled in runConversation
    });

    it("handles tool calls and continues conversation", async () => {
      const mockResponse = {
        response: { status: "passed", reason: "test completed" },
        metadata: {
          usage: {
            completionTokens: 10,
            promptTokens: 20,
            totalTokens: 30,
          },
        },
      };

      vi.spyOn(client as any, "runConversation").mockResolvedValue(
        mockResponse,
      );

      const result = await client.runAction("test prompt");

      expect(result).toEqual(mockResponse);
      expect(testRun.cache.set).not.toHaveBeenCalled(); // Cache is handled in runConversation
    });

    describe("error handling", () => {
      it("retries on retryable errors", async () => {
        const error = new Error("Network error");
        const mockResponse = {
          response: { status: "passed", reason: "test passed" },
          metadata: {
            usage: {
              completionTokens: 10,
              promptTokens: 20,
              totalTokens: 30,
            },
          },
        };

        vi.spyOn(client as any, "runConversation")
          .mockRejectedValueOnce(error)
          .mockResolvedValue(mockResponse);

        const result = await client.runAction("test prompt");

        expect(result).toEqual(mockResponse);
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
          vi.spyOn(client as any, "runConversation").mockRejectedValue(error);

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
        vi.spyOn(client as any, "runConversation")
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
