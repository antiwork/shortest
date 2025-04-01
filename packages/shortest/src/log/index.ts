/**
 * Logging system entry point that provides singleton logger instance and exports
 * core logging components.
 *
 * @module
 *
 * @example
 * ```typescript
 * import { getLogger } from "@/log";
 *
 * const log = getLogger({ level: "debug" });
 * log.info("Application started");
 * ```
 *
 * @see {@link Log} for main logging interface
 * @see {@link LogGroup} for log grouping functionality
 *
 * @private
 */

import { LogConfig } from "@/log/config";
import { Log } from "@/log/log";

export { Log };
export { LogGroup } from "@/log/group";

let instance: Log | null = null;

/**
 * Gets or creates singleton logger instance
 *
 * @param {Partial<LogConfig>} [config] - Optional logger configuration
 * @returns {Log} Singleton logger instance
 *
 * @example
 * ```typescript
 * const log = getLogger({ level: "debug", format: "terminal" });
 * ```
 */
export const getLogger = (config?: Partial<LogConfig>): Log => {
  if (instance) {
    return instance;
  }
  instance = new Log(config);
  return instance;
};
