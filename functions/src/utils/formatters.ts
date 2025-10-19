export function formatDate(date: Date): string {
    return date.toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric"
    });
}
