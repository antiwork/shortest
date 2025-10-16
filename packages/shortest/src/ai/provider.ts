import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModelV1 } from "ai";
import { AIConfig } from "@/types";
import { AIError } from "@/utils/errors";

/**
 * Creates a custom AI provider based on the provided configuration.
 *
 * @private
 */
export const createProvider = (aiConfig: AIConfig): LanguageModelV1 => {
  switch (aiConfig.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: aiConfig.apiKey });
      return anthropic(aiConfig.model) as LanguageModelV1;
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: aiConfig.apiKey });
      return openai(aiConfig.model) as LanguageModelV1;
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: aiConfig.apiKey });
      return google(aiConfig.model) as LanguageModelV1;
    }
    default:
      throw new AIError(
        "unsupported-provider",
        `${aiConfig.provider} is not supported.`,
      );
  }
};
