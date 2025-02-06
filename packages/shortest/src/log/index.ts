import { LogConfig } from "./config";
import { Log } from "./log";
export { Log };
export { LogGroup } from "./group";

let instance: Log | null = null;

export function getLogger(config?: Partial<LogConfig>): Log {
  if (instance) {
    return instance;
  }
  instance = new Log(config);
  return instance;
}
