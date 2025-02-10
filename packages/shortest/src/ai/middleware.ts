import type {
  DeepPartial,
  LanguageModelV1,
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
} from "ai";

import { TestCache } from "@/cache/test-cache";
import { TestFunction } from "@/types/test";
import { CacheStore } from "@/cache/interfaces";
import { generateMD5Hash } from "@/cache/utils/hash-generator";
import { extractJsonPayload, llmJSONResponseSchema } from "./utils/json";
import { assembleCacheKey } from "@/cache/utils/assemble-cache-key";
import { emitCache } from "@/cache/utils/emit-cache";

type DoGenerateResult = Awaited<ReturnType<LanguageModelV1["doGenerate"]>>;

export function getCacheMiddleware(
  test: TestFunction,
): LanguageModelV1Middleware {
  const namespace = "ai";
  const cache = new TestCache(test);
  const tempCache: CacheStore = new Map();

  return {
    wrapGenerate: async ({ doGenerate, params }) => {
      const cacheKey = assembleCacheKey(namespace, generateMD5Hash(params));

      const cached = (await cache.get(cacheKey)) as
        | DoGenerateResult
        | null
        | undefined;

      console.log("Middleware");

      if (cached !== null && cached !== undefined) {
        return {
          ...cached,
          response: {
            ...cached.response,
            timestamp: cached?.response?.timestamp
              ? new Date(cached?.response?.timestamp)
              : undefined,
          },
        };
      }

      const result = await doGenerate();

      cache.set(cacheKey, formatResult(result));

      try {
        if (result.text) {
          const json = extractJsonPayload(result.text, llmJSONResponseSchema);
          if (json.result === "pass") {
            await emitCache(tempCache, cache);
          }
        }
      } catch (error) {
        // Fallthrough
      }

      return result;
    },
  };
}

function formatResult(result: DoGenerateResult): DeepPartial<DoGenerateResult> {
  return {
    toolCalls: result.toolCalls,
    usage: result.usage,
    finishReason: result.finishReason,
    text: result.text,
  };
}
