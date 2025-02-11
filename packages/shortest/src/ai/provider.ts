import { LanguageModelV1 } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { AIConfig } from "@/types";

/**
 * Mapping of high-level model aliases to actual model IDs for Anthropic.
 * For example, the high-level alias "claude-sonnet-3.5" is mapped to the
 * underlying model ID consumed by the SDK.
 */
const anthropicModelMapping: Record<string, string> = {
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
};

/**
 * Creates a custom AI provider based on the provided configuration.
 *
 */
export function createAIProvider(config: AIConfig): LanguageModelV1 {
  switch (config.provider) {
    case "anthropic":
      const anthropic = createAnthropic({ apiKey: config.apiKey });
      return anthropic(anthropicModelMapping[config.model]) as LanguageModelV1;
  }
}
