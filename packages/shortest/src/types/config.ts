import { z } from "zod";
import { AISupportedModels } from "./ai";
import { getShortestEnv } from "@/utils/get-from-env";
import { MakeOptional } from "@/utils/types";

// #startblock Mailosaur
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
// #endblock Mailosaur

// #startblock Bedrock
const amazonBedrockSchema = z.object({
  provider: z.literal("amazon-bedrock"),
  region: z.string().default(() => getShortestEnv("AWS_REGION")!),
  accessKeyId: z.string().default(() => getShortestEnv("AWS_ACCESS_KEY_ID")!),
  secretAccessKey: z
    .string()
    .default(() => getShortestEnv("AWS_SECRET_ACCESS_KEY")!),
  model: z.enum(["claude-3-5-sonnet"]).default("claude-3-5-sonnet"),
});

export interface AmazonBedrockProviderConfig {
  provider: "amazon-bedrock";
  region: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  model: AISupportedModels;
}

interface AmazonBedrockProviderPublicConfig {
  provider: "amazon-bedrock";
  region?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  model?: AISupportedModels;
}
// #endblock Bedrock

// #startblock Anthropic
const anthropicSchema = z.object({
  provider: z.literal("anthropic"),
  apiKey: z.string().default(process.env.ANTHROPIC_API_KEY!),
  model: z.enum(["claude-3-5-sonnet"]).default("claude-3-5-sonnet"),
});

export interface AnthropicConfig {
  provider: "anthropic";
  apiKey: string | undefined;
  model: AISupportedModels;
}

export interface AnthropicPublicConfig {
  provider: "anthropic";
  apiKey: string | undefined;
  model?: AISupportedModels;
}
// #endblock Anthropic

// #startblock AI
const aiSchema = z.discriminatedUnion("provider", [
  anthropicSchema,
  amazonBedrockSchema,
]);

export type AIConfig = AmazonBedrockProviderConfig | AnthropicConfig;

export type AIPublicConfig =
  | AmazonBedrockProviderPublicConfig
  | AnthropicPublicConfig;
// #endblock AI

// #startblock Config
interface ConfigBase {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
}

export type ShortestPublicConfig = ConfigBase &
  Partial<{
    mailosaur: MakeOptional<MailosaurConfig, "apiKey" | "serverId">;
    ai: AIPublicConfig;
    /** @deprecated Use the new 'ai' configuration instead */
    anthropicKey: string;
  }>;

export type ShortestConfig = ConfigBase & {
  mailosaur?: MailosaurConfig;
  ai: AIConfig;
};

export const configSchema = z
  .object({
    headless: z.boolean(),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: z.string(),
    ai: aiSchema.optional(),
    anthropicKey: z.string().optional(),
    mailosaur: mailosaurSchema.optional(),
  })
  .transform(transformLegacyConfig)
  .refine((config) => !!config.ai, {
    message:
      "No AI configuration provided. Please provide the 'ai' configuration.",
  })
  .refine((config) => !config.anthropicKey, {
    message:
      "Both 'ai' and legacy 'anthropicKey' are provided. Please remove the deprecated 'anthropicKey'.",
  });
// #endblock Config

function transformLegacyConfig(config: any) {
  const legacyApiKey = process.env.ANTHROPIC_API_KEY ?? config.anthropicKey;
  if (!config.ai && legacyApiKey) {
    console.warn(
      "'anthropicKey' is deprecated. Use the new 'ai' option structure instead.",
    );
    config.ai = {
      provider: "anthropic",
      apiKey: legacyApiKey,
      model: "claude-3-5-sonnet",
    };
    delete config.anthropicKey;
  }
  return config;
}
