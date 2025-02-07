import { z } from "zod";
import {
  LLMSupportedModels,
  LLMSupportedModelsType,
  LLMSupportedProviders,
  LLMSupportedProvidersType,
} from "./ai";
import { getDefaultProviderModel } from "@/ai/client-provider";
import { MakeOptional } from "@/utils/types";

/**
 * Schema for Mailosaur configuration.
 */
const mailosaurSchema = z
  .object({
    apiKey: z.string(),
    serverId: z.string(),
  })
  .optional();

export interface MailosaurConfig {
  apiKey: string;
  serverId: string;
}

/**
 * Schema for the LLM (AI) configuration.
 * If no model is provided, falls back to a default based on the provider.
 */
const llmSchema = z.object({
  provider: z.literal(LLMSupportedProviders.ANTHROPIC),
  apiKey: z.string(),
  model: z
    .enum([LLMSupportedModels.CLAUDE_3_5_SONNET])
    .default(getDefaultProviderModel(LLMSupportedProviders.ANTHROPIC)),
});
export interface LLMConfig {
  provider: LLMSupportedProviders;
  apiKey: string;
  model: LLMSupportedModels;
}

export interface LLMPPublicConfig {
  provider: LLMSupportedProvidersType;
  apiKey: string | undefined;
  model?: LLMSupportedModelsType;
}

/**
 * Base configuration interface.
 */
interface ConfigBase {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
}

// Internal resolved config, single source of truth
export type ShortestConfig = ConfigBase & {
  mailosaur?: MailosaurConfig;
  ai: LLMConfig;
};

// Config used by Shortest users
export type ShortestPublicConfig = ConfigBase &
  Partial<{
    mailosaur: MakeOptional<MailosaurConfig, "apiKey" | "serverId">;
    ai: LLMPPublicConfig;
    /** @deprecated Use the new 'ai' configuration instead */
    anthropicKey: string;
  }>;

const rawConfigSchema = z
  .object({
    headless: z.boolean(),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: z.string(),
    ai: llmSchema.optional(),
    anthropicKey: z.string().optional(),
    mailosaur: mailosaurSchema.optional(),
  })
  .strict();

/**
 * Main configuration schema.
 * - Validates that either `ai` or the legacy `anthropicKey` is provided (but not both).
 * - Transforms legacy configuration to the new format.
 */
export const configSchema = rawConfigSchema
  .superRefine((config, ctx) => {
    if (!config.ai && !config.anthropicKey && !process.env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No AI configuration provided. Please provide the 'ai' configuration.",
      });
    } else if (config.ai && config.anthropicKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Both 'ai' and legacy 'anthropicKey' are provided. Please remove the deprecated 'anthropicKey'.",
      });
    }
  })
  .transform((config) => {
    if (!config.ai && (config.anthropicKey || process.env.ANTHROPIC_API_KEY)) {
      console.warn(
        "'anthropicKey' option id deprecated. Use the new 'ai' option structure instead.",
      );
      config.ai = {
        provider: LLMSupportedProviders.ANTHROPIC,
        apiKey: (process.env.ANTHROPIC_API_KEY ??
          config.anthropicKey) as string,
        model: LLMSupportedModels.CLAUDE_3_5_SONNET,
      };
      delete config.anthropicKey;
    }
    return { ...config };
  });
