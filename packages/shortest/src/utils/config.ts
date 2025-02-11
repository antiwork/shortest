import { z } from "zod";
import { configSchema, ShortestConfig } from "../types/config";
import { ConfigError } from "./errors";
import { formatZodError } from "./zod";
import { getLogger } from "@/log/index";

export const parseConfig = (config: unknown): ShortestConfig => {
  const log = getLogger();
  log.trace("Parsing config", { config });
  try {
    return configSchema.parse(config) as ShortestConfig;
  } catch (error) {
    log.error("Error parsing config", { error });
    if (error instanceof z.ZodError) {
      throw new ConfigError(
        "invalid-config",
        formatZodError(error, "Invalid shortest.config"),
      );
    }
    throw error;
  }
};
