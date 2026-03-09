export function formatDate(date: Date): string {
    return date.toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric"
    });
}

export function formatDateTime(date: Date): string {
    // Convert to French timezone (Europe/Paris)
    // const frenchDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));

    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatError(error: unknown): string {
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const e = error as any;
        const status = e.response?.status ?? 'no response';
        const url = e.config?.url ?? 'unknown URL';
        return `${url} → ${status}: ${e.message}`;
    }
    return error instanceof Error ? error.message : String(error);
}
