import { createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModelV1 } from "ai";
import { AIConfig } from "@/types";
import { AIError } from "@/utils/errors";
import { setGlobalDispatcher, EnvHttpProxyAgent } from "undici";

/**
 * Creates a custom AI provider based on the provided configuration.
 *
 * @private
 */
export const createProvider = (aiConfig: AIConfig): LanguageModelV1 => {
  switch (aiConfig.provider) {
    case "anthropic":
      if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
        // Apply proxy-related environment variables to the global fetch function using undici
        // If using custom CA certificates, set the NODE_EXTRA_CA_CERTS environment variable
        setGlobalDispatcher(new EnvHttpProxyAgent());
      }
      const anthropic = createAnthropic({ apiKey: aiConfig.apiKey, fetch: globalThis.fetch });
      return anthropic(aiConfig.model) as LanguageModelV1;
    default:
      throw new AIError(
        "unsupported-provider",
        `${aiConfig.provider} is not supported.`,
      );
  }
};
