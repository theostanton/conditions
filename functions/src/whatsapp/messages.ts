/**
 * All user-facing WhatsApp message strings, centralised for consistency.
 *
 * Conventions:
 *   • Massif, mountain and place names are *bold* (`*name*`).
 *   • Voice is friendly second-person — no first-person "I".
 *   • Help text is kept short outside of the welcome message.
 */

const HELP_SHORT = 'Send a place name, share your location, or browse all massifs.';

export namespace Messages {

    // ── Welcome & help ──────────────────────────────────────────────

    export const welcome =
        `🏔️ Welcome to Conditions!\n\nSend a place name, share your location or browse all massifs to get an avalanche bulletin.`;

    export const error = 'Something went wrong. Please try again.';

    // ── Search / geocode ────────────────────────────────────────────

    export function multipleMatches(count: number, query: string): string {
        return `${count} massifs match "*${query}*". Which one?`;
    }

    export function noResultsFor(query: string): string {
        return `No results for "*${query}*".\n\n${HELP_SHORT}`;
    }

    export function outsideCoverage(query: string): string {
        return `*${query}* doesn't appear to be in a massif.\n\n${HELP_SHORT}`;
    }

    export const locationNotFound =
        `No massif found at your location.\n\nTry a massif name or browse the list.`;

    // ── Browse flow ─────────────────────────────────────────────────

    export function chooseMountain(page: number): string {
        return page > 0
            ? `Mountain ranges (page ${page + 1}):`
            : 'Choose a mountain range.';
    }

    export function chooseMassif(mountain: string, page: number): string {
        return page > 0
            ? `Massifs in *${mountain}* (page ${page + 1}):`
            : `Choose a massif in *${mountain}*.`;
    }

    export function noMassifsInMountain(mountain: string): string {
        return `No massifs found in *${mountain}*.`;
    }

    // ── Bulletin delivery ───────────────────────────────────────────

    export const massifNotFound = 'Massif not found. Send a name or browse the list.';

    export function geocodeHint(query: string, massifName: string): string {
        return `Looks like *${query}* is within the *${massifName}* massif.\n\nDouble check that is correct before using this bulletin.`;
    }

    export function noBulletin(massifName: string): string {
        return `No bulletin available for *${massifName}* right now.`;
    }

    // ── Subscriptions ───────────────────────────────────────────────

    export function subscribed(massifName: string): string {
        return `Subscribed to daily *${massifName}* bulletins.`;
    }

    export function subscribedTo(massifName: string): string {
        return `Subscribed to *${massifName}*.`;
    }

    export function subscribedToCount(count: number): string {
        return `Subscribed to ${count} massifs.`;
    }

    export function unsubscribed(massifName: string): string {
        return `Unsubscribed from *${massifName}*.`;
    }

    export const noSubscriptions =
        'No active subscriptions.\n\nSend a place name or share your location to get started.';
}
