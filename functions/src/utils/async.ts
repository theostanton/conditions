export namespace AsyncUtils {
    /**
     * Delays execution for specified milliseconds
     */
    export function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
