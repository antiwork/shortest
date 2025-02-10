import { TestFunction } from "@/types";
import { generateSHA1Hash } from "@/utils/hash";
import { Cache } from "./cache";

export class TestCache extends Cache {
  /**
   * Creates a TestCache instance.
   * @param test - Test data to generate the cache ID.
   */
  constructor(test: TestFunction) {
    const cacheId = TestCache.generateTestCacheId(test);
    super(cacheId);
    super.set("id", cacheId);
  }

  /**
   * Generates an 8-character cache ID from the SHA‑1 hash of the test data.
   * @param test - Test data.
   * @returns An 8-character cache ID.
   */
  public static generateTestCacheId(test: TestFunction): string {
    const sha1Hash = generateSHA1Hash(test);
    return sha1Hash.slice(0, 8);
  }
}
