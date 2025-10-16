import { describe, expect, it, vi } from "vitest";
import { createProvider } from "./provider";
import { AIConfig } from "@/types";

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (model: string) => ({ model })),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => ({ model })),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => (model: string) => ({ model })),
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

  it("creates an OpenAI provider with correct config", () => {
    const config: AIConfig = {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4o",
    };

    const provider = createProvider(config);
    expect(provider).toEqual({ model: "gpt-4o" });
  });

  it("creates a Google provider with correct config", () => {
    const config: AIConfig = {
      provider: "google",
      apiKey: "test-key",
      model: "gemini-2.0-flash-exp",
    };

    const provider = createProvider(config);
    expect(provider).toEqual({ model: "gemini-2.0-flash-exp" });
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
