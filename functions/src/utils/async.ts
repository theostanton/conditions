export namespace AsyncUtils {
    /**
     * Delays execution for specified milliseconds
     */
    export function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retries a function with exponential backoff on failure.
     */
    export async function retry<T>(
        fn: () => Promise<T>,
        maxRetries: number = 2,
        baseDelayMs: number = 1000,
    ): Promise<T> {
        let lastError: unknown;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const backoff = baseDelayMs * Math.pow(2, attempt);
                    await delay(backoff);
                }
            }
        }
        throw lastError;
    }

    /**
     * Like Promise.allSettled but processes items in batches with delays between them.
     * Limits concurrency to avoid overwhelming external APIs.
     */
    export async function batchSettled<T, R>(
        items: T[],
        fn: (item: T) => Promise<R>,
        batchSize: number = 3,
        delayMs: number = 500,
    ): Promise<PromiseSettledResult<R>[]> {
        const results: PromiseSettledResult<R>[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            if (i > 0) await delay(delayMs);
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch.map(fn));
            results.push(...batchResults);
        }
        return results;
    }
}
