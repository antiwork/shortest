import { z } from "zod";

export interface ShortestConfig {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
  anthropicKey?: string;
  ai: {
    provider: "amazon-bedrock" | "anthropic";
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    model?: "claude-3-5-sonnet";
  };
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

const aiSchema = z.object({
  provider: z.enum(["amazon-bedrock", "anthropic"]),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  model: z.enum(["claude-3-5-sonnet"]).optional(),
});

export const configSchema = z.object({
  headless: z.boolean(),
  baseUrl: z.string().url("must be a valid URL"),
  testPattern: z.string(),
  ai: aiSchema,
  mailosaur: mailosaurSchema,
});
