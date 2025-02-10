import { CacheStore } from "../interfaces";
import { TestCache } from "../test-cache";

export async function emitCache(
  tempCache: CacheStore,
  cache: TestCache,
): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (const [key, value] of tempCache.entries()) {
    promises.push(cache.set(key, value));
  }
  await Promise.all(promises);
}
