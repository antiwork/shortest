import { describe, expect, it, vi } from "vitest";
import { createProvider } from "./provider";
import { AIConfig } from "@/types";

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (model: string) => ({ model })),
}));

describe("createProvider", () => {
  it("creates an Anthropic provider with correct config", () => {
    const config: AIConfig = {
      provider: "anthropic",
      apiKey: "test-key",
      model: "claude-3-5-sonnet-20241022",
    };

    const provider = createProvider(config);
    expect(provider).toEqual({ model: "claude-3-5-sonnet-20241022" });
  });

  it("throws AIError for unsupported provider", () => {
    const config = {
      provider: "unsupported",
      apiKey: "test-key",
      model: "claude-3-5-sonnet-20241022",
    } as unknown as AIConfig;

    expect(() => createProvider(config)).toThrow(
      "unsupported is not supported.",
    );
  });
});
