import { z, ZodError } from "zod";
import { ConfigError } from "./errors";

export interface ShortestConfig {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
  anthropicKey?: string;
  mailosaur?: {
    apiKey?: string;
    serverId?: string;
  };
}

const mailosaurSchema = z
  .object({
    apiKey: z.string(),
    serverId: z.string(),
  })
  .optional();

export const configSchema = z
  .object({
    headless: z.boolean(),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: z.string(),
    anthropicKey: z.string().optional(),
    mailosaur: mailosaurSchema,
  })
  .refine((config) => config.anthropicKey || process.env.ANTHROPIC_API_KEY, {
    message:
      "anthropicKey must be provided in config or ANTHROPIC_API_KEY environment variable",
  });

export const validateConfig = (config: unknown): ShortestConfig => {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigError(formatZodError(error));
    }
    throw error;
  }
};

const formatZodError = (error: ZodError) => {
  console.log("[debug]: formatZodError", error.format());
  const errorsString = error.errors
    .map((err) => {
      const path = err.path.join(".");
      const prefix = path ? `${path}: ` : "";
      return `${prefix}${err.message}`;
    })
    .join("\n");

  return `Invalid shortest.config\n${errorsString}`;
};
