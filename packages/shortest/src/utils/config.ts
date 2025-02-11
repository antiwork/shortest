import { z, ZodError } from "zod";
import { getLogger } from "@/log/index";
import { configSchema, ShortestConfig } from "@/types/config";
import { ConfigError } from "@/utils/errors";

export const parseConfig = (config: unknown): ShortestConfig => {
  const log = getLogger();
  log.trace("Parsing config", { config });
  try {
    return configSchema.parse(config);
  } catch (error) {
    log.error("Error parsing config", { error });
    if (error instanceof z.ZodError) {
      throw new ConfigError("invalid-config", formatZodError(error));
    }
    throw error;
  }
};

const formatZodError = (error: ZodError) => {
  const errorsString = error.errors
    .map((err) => {
      const path = err.path.join(".");
      const prefix = path ? `${path}: ` : "";
      return `${prefix}${err.message}`;
    })
    .join("\n");

  return `Invalid shortest.config\n${errorsString}`;
};
