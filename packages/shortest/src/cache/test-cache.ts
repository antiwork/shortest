import { BaseCache } from "@/cache/base-cache";
import { CacheEntry } from "@/types/cache";
import { TestFunction } from "@/types/test";

export class TestCache extends BaseCache<CacheEntry> {
  private readonly enabled: boolean;

  constructor({ enableCache = true }: { enableCache?: boolean } = {}) {
    super();
    this.enabled = enableCache;
  }

  async get(test: TestFunction): Promise<CacheEntry | null> {
    if (!this.enabled) return null;
    return super.get(test);
  }

  async set(
    test: TestFunction,
    entry: Partial<CacheEntry["data"]>,
  ): Promise<void> {
    if (!this.enabled) return;
    return super.set(test, entry);
  }

  saveScreenshot = (_test: TestFunction, _base64Image: string): string => "";
}
