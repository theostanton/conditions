export namespace AsyncUtils {
    /**
     * Delays execution for specified milliseconds
     */
    export function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
