import path from "node:path";

export const CACHE_DIR = path.join(process.cwd(), ".shortest", "cache");
export const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 WEEK
export const CLEANUP_PROBABILITY = 0.01; // 1%
export const CACHE_LOCK_TIMEOUT_MS = 1_000; // 1 SECOND
