/**
 * Assembles a cache key using a namespace and an MD5 hash.
 *
 * @param namespace - The namespace for the cache entry.
 * @param md5Hash - The MD5 hash generated from the parameters.
 * @returns The assembled cache key in the format 'namespace:md5Hash'.
 */
export function assembleCacheKey(namespace: string, md5Hash: string): string {
  return `${namespace}:${md5Hash}`;
}
