import { z } from "zod";

export const DEFAULT_REPO_CONFIG = {
  test_patterns: ["*.test.*"],
};

export const RepositoryConfig = z.object({
  test_patterns: z
    .array(z.string().transform((s) => s.toLowerCase()))
    .default(DEFAULT_REPO_CONFIG.test_patterns),
});

export const ConfigSchema = z.record(RepositoryConfig);

export type Config = z.infer<typeof ConfigSchema>;
export type RepositoryConfig = z.infer<typeof RepositoryConfig>;
