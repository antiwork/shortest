import { BrowserContextOptions } from "playwright";
import { z } from "zod";

export const cliOptionsSchema = z.object({
  headless: z.boolean().optional(),
  baseUrl: z.string().optional().default("http://localhost:3000"),
  testPattern: z.string().optional().default("**/*.test.ts"),
  noCache: z.boolean().optional(),
});
export type CLIOptions = z.infer<typeof cliOptionsSchema>;

/**
 * List of Anthropic models that are supported by the AI client.
 *
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#model-capabilities
 * @see https://docs.anthropic.com/en/docs/about-claude/models/all-models
 */
export const ANTHROPIC_MODELS = [
  "claude-4-sonnet-20250514",
  "claude-4-sonnet-latest",
  "claude-4-opus-20250514",
  "claude-4-opus-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-7-sonnet-20250219",
  "claude-3-7-sonnet-latest",
] as const;
export const anthropicModelSchema = z.enum(ANTHROPIC_MODELS);
export type AnthropicModel = z.infer<typeof anthropicModelSchema>;

/**
 * List of OpenAI models that are supported by the AI client.
 *
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/openai#model-capabilities
 * @see https://platform.openai.com/docs/models
 */
export const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
] as const;
export const openaiModelSchema = z.enum(OPENAI_MODELS);
export type OpenAIModel = z.infer<typeof openaiModelSchema>;

/**
 * List of Google (Gemini) models that are supported by the AI client.
 *
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai#model-capabilities
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export const GOOGLE_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
] as const;
export const googleModelSchema = z.enum(GOOGLE_MODELS);
export type GoogleModel = z.infer<typeof googleModelSchema>;

const SHORTEST_ENV_PREFIX = "SHORTEST_";
const getShortestEnvName = (key: string) => `${SHORTEST_ENV_PREFIX}${key}`;

const aiSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("anthropic"),
    apiKey: z
      .string()
      .default(
        () =>
          process.env[getShortestEnvName("ANTHROPIC_API_KEY")] ||
          process.env.ANTHROPIC_API_KEY\!,
      ),
    model: z.enum(ANTHROPIC_MODELS).default(ANTHROPIC_MODELS[0]),
  }).strict(),
  z.object({
    provider: z.literal("openai"),
    apiKey: z
      .string()
      .default(
        () =>
          process.env[getShortestEnvName("OPENAI_API_KEY")] ||
          process.env.OPENAI_API_KEY\!,
      ),
    model: z.enum(OPENAI_MODELS).default(OPENAI_MODELS[0]),
  }).strict(),
  z.object({
    provider: z.literal("google"),
    apiKey: z
      .string()
      .default(
        () =>
          process.env[getShortestEnvName("GOOGLE_API_KEY")] ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY\!,
      ),
    model: z.enum(GOOGLE_MODELS).default(GOOGLE_MODELS[0]),
  }).strict(),
]);
export type AIConfig = z.infer<typeof aiSchema>;

const cachingSchema = z
  .object({
    enabled: z.boolean().default(true),
  })
  .strict();
export type CachingConfig = z.infer<typeof cachingSchema>;

const mailosaurSchema = z
  .object({
    apiKey: z.string(),
    serverId: z.string(),
  })
  .optional();

export const testPatternSchema = z.string().default("**/*.test.ts");

const browserSchema = z.object({
  /**
   * @see https://playwright.dev/docs/api/class-browser#browser-new-context
   */
  contextOptions: z.custom<BrowserContextOptions>().optional(),
});

export const configSchema = z
  .object({
    headless: z.boolean().default(true),
    baseUrl: z.string().url("must be a valid URL"),
    browser: browserSchema.strict().partial().default(browserSchema.parse({})),
    testPattern: testPatternSchema,
    anthropicKey: z.string().optional(),
    ai: aiSchema,
    mailosaur: mailosaurSchema.optional(),
    caching: cachingSchema.optional().default(cachingSchema.parse({})),
  })
  .strict();

export const userConfigSchema = configSchema.extend({
  browser: browserSchema.optional(),
  testPattern: testPatternSchema.optional(),
  ai: aiSchema.partial().optional(),
  caching: cachingSchema.strict().partial().optional(),
});

// User-provided config type - allows partial/optional AI settings
// Used when reading config from shortest.config.ts
export type ShortestConfig = z.infer<typeof userConfigSchema>;

// Internal fully-validated config type with required fields
// Used after config validation and defaults are applied
export type ShortestStrictConfig = z.infer<typeof configSchema>;
