import { z } from "zod";

export const cliOptionsSchema = z.object({
  headless: z.boolean().optional(),
  baseUrl: z.string().optional(),
  testPattern: z.string().optional(),
  noCache: z.boolean().optional(),
});
export type CLIOptions = z.infer<typeof cliOptionsSchema>;

const ANTHROPIC_MODELS = ["claude-3-5-sonnet-20241022"] as const;

const aiSchema = z
  .object({
    provider: z.literal("anthropic"),
    apiKey: z
      .string()
      .default(
        () =>
          process.env[getShortestEnvName("ANTHROPIC_API_KEY")] ||
          process.env.ANTHROPIC_API_KEY!,
      ),
    model: z.enum(ANTHROPIC_MODELS).default(ANTHROPIC_MODELS[0]),
  })
  .strict();
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

export const configSchema = z
  .object({
    headless: z.boolean().default(true),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: testPatternSchema,
    anthropicKey: z.string().optional(),
    ai: aiSchema,
    mailosaur: mailosaurSchema.optional(),
    caching: cachingSchema.optional().default(cachingSchema.parse({})),
  })
  .strict();

export const userConfigSchema = configSchema.extend({
  testPattern: testPatternSchema.optional(),
  ai: aiSchema.strict().partial().optional(),
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
