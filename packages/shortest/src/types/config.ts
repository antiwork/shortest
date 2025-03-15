import { BrowserContextOptions } from "playwright";
import { z } from "zod";

export const cliOptionsSchema = z.object({
  headless: z.boolean().optional(),
  baseUrl: z.string().optional(),
  testPattern: z.string().optional(),
  noCache: z.boolean().optional(),
});
export type CLIOptions = z.infer<typeof cliOptionsSchema>;

/**
 * List of Anthropic models that are supported by the AI client with computer use.
 *
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#model-capabilities
 * @see https://docs.anthropic.com/en/docs/about-claude/models/all-models
 */
export const ANTHROPIC_MODELS = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-7-sonnet-20250219",
  "claude-3-7-sonnet-latest",
] as const;
export const anthropicModelSchema = z.enum(ANTHROPIC_MODELS);
export type AnthropicModel = z.infer<typeof anthropicModelSchema>;

const baseAnthropicSchema = z
  .object({
    provider: z.literal("anthropic"),
    apiKey: z.string(),
    model: anthropicModelSchema,
  })
  .strict();
const aiAnthropicSchema = baseAnthropicSchema.extend({
  apiKey: z
    .string()
    .default(
      () =>
        process.env[getShortestEnvName("ANTHROPIC_API_KEY")] ||
        process.env.ANTHROPIC_API_KEY!,
    ),
  model: anthropicModelSchema.default(ANTHROPIC_MODELS[0]),
});

/**
 * List of OpenAI models that are supported by the AI client with computer use..
 *
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/openai#model-capabilities
 */
export const OPENAI_MODELS = ["computer-use-preview-2025-02-04"] as const;
export const openaiModelSchema = z.enum(OPENAI_MODELS);
export type OpenAIModel = z.infer<typeof openaiModelSchema>;

const baseOpenaiSchema = z
  .object({
    provider: z.literal("openai"),
    apiKey: z.string(),
    model: openaiModelSchema,
  })
  .strict();
const aiOpenaiSchema = baseOpenaiSchema.extend({
  apiKey: z
    .string()
    .default(
      () =>
        process.env[getShortestEnvName("OPENAI_API_KEY")] ||
        process.env.OPENAI_API_KEY!,
    ),
  model: openaiModelSchema.default(OPENAI_MODELS[0]),
});

const aiSchema = z.discriminatedUnion("provider", [
  aiAnthropicSchema,
  aiOpenaiSchema,
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

const testPatternSchema = z.string().default("**/*.test.ts");

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

const userAiSchema = z.discriminatedUnion("provider", [
  baseAnthropicSchema.extend({
    apiKey: z.string().optional(),
    model: anthropicModelSchema.optional(),
  }),
  baseOpenaiSchema.extend({
    apiKey: z.string().optional(),
    model: openaiModelSchema.optional(),
  }),
]);

export const userConfigSchema = configSchema.extend({
  browser: browserSchema.optional(),
  testPattern: testPatternSchema.optional(),
  ai: userAiSchema,
  caching: cachingSchema.strict().partial().optional(),
});

const SHORTEST_ENV_PREFIX = "SHORTEST_";

const getShortestEnvName = (key: string) => `${SHORTEST_ENV_PREFIX}${key}`;

// User-provided config type - allows partial/optional AI settings
// Used when reading config from shortest.config.ts
export type ShortestConfig = z.infer<typeof userConfigSchema>;

// Internal fully-validated config type with required fields
// Used after config validation and defaults are applied
export type ShortestStrictConfig = z.infer<typeof configSchema>;
