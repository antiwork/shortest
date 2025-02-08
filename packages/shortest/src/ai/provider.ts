import { createAnthropic } from "@ai-sdk/anthropic";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { LanguageModelV1 } from "ai";
import { AIConfig } from "@/types";

/**
 * Mapping of high-level model aliases to actual model IDs for Anthropic.
 * For example, the high-level alias "claude-sonnet-3.5" is mapped to the
 * underlying model ID consumed by the SDK.
 */
const anthropicModelMapping: Record<string, string> = {
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
};

const bedrockModelMapping: Record<string, string> = {
  "claude-3-5-sonnet": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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
    case "amazon-bedrock":
      const amazonBedrock = createAmazonBedrock({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
      return amazonBedrock(
        bedrockModelMapping[config.model],
      ) as LanguageModelV1;
  }
}
