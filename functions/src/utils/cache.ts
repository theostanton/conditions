/**
 * Promise-based cache with automatic failure eviction.
 * Caches the promise itself (not the resolved value) so concurrent callers
 * share a single in-flight request.
 */
export function createPromiseCache<V>() {
    const cache = new Map<string, Promise<V>>();

    return {
        getOrCreate(key: string, fetcher: () => Promise<V>): Promise<V> {
            const cached = cache.get(key);
            if (cached) return cached;

            const promise = fetcher();
            cache.set(key, promise);

            // Remove from cache on failure so retries can re-fetch
            promise.catch(() => cache.delete(key));

            return promise;
        },
        clear(): void {
            cache.clear();
        },
    };
}
