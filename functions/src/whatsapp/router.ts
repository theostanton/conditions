import {MassifCache} from "@cache/MassifCache";
import {WhatsAppClient} from "@whatsapp/client";
import {BulletinFlow} from "@whatsapp/flows/bulletin";
import {Messages} from "@whatsapp/messages";
import type {WAWebhookPayload, WAMessage} from "@whatsapp/types";
import {Analytics} from "@analytics/Analytics";
import {geocode} from "@utils/geocode";
import {GeocodeCache} from "@database/models/GeocodeCache";

export interface ConversationState {
    step: 'idle' | 'select_mountain' | 'select_massif';
    mountain?: string;
    lastActivity: number;
}

const conversations = new Map<string, ConversationState>();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getState(from: string): ConversationState {
    const state = conversations.get(from);
    if (state && Date.now() - state.lastActivity < STATE_TTL_MS) {
        return state;
    }
    return {step: 'idle', lastActivity: Date.now()};
}

function setState(from: string, partial: Partial<ConversationState>): void {
    const current = getState(from);
    conversations.set(from, {...current, ...partial, lastActivity: Date.now()});
}

function clearState(from: string): void {
    conversations.delete(from);
}

function cleanupStaleStates(): void {
    const now = Date.now();
    for (const [key, state] of conversations) {
        if (now - state.lastActivity > STATE_TTL_MS) {
            conversations.delete(key);
        }
    }
}

const GREETING_PATTERN = /^(hi|hello|hey|heya|start|help|good\s+morning|good\s+evening|good\s+afternoon|bonjour|salut|coucou|bonsoir|yo|howdy)\b[!.,;:\s]*/i;

function detectPleasantry(text: string): { isGreeting: boolean; remaining: string } {
    const match = text.trim().match(GREETING_PATTERN);
    if (!match) return {isGreeting: false, remaining: text.trim()};
    return {isGreeting: true, remaining: text.trim().substring(match[0].length).trim()};
}

async function sendWelcome(to: string): Promise<void> {
    Analytics.send(`WA ${to} welcome`).catch(console.error);
    await WhatsAppClient.sendReplyButtons(
        to,
        Messages.welcome,
        [{id: 'menu:browse', title: '🗺️ Browse all massifs'}],
    );
}

export namespace WhatsAppRouter {

    export async function handleWebhook(payload: WAWebhookPayload): Promise<void> {
        if (payload.object !== 'whatsapp_business_account') return;

        cleanupStaleStates();

        for (const entry of payload.entry) {
            for (const change of entry.changes) {
                if (change.field !== 'messages') continue;

                const messages = change.value.messages;
                if (!messages) continue;

                for (const message of messages) {
                    try {
                        await handleMessage(message);
                    } catch (error) {
                        console.error(`Error handling message from ${message.from}:`, error);
                        await Analytics.sendError(
                            error as Error,
                            `WhatsAppRouter: Error handling message from ${message.from}`
                        ).catch(err => console.error('Failed to send error analytics:', err));

                        try {
                            await WhatsAppClient.sendText(message.from, Messages.error);
                        } catch {
                        }
                    }
                }
            }
        }
    }

    async function handleMessage(message: WAMessage): Promise<void> {
        const from = message.from;

        // Mark as read — fire and forget
        WhatsAppClient.markAsRead(message.id).catch(() => {
        });

        // Handle location messages
        if (message.type === 'location' && message.location) {
            await handleLocation(from, message.location.latitude, message.location.longitude);
            return;
        }

        // Handle interactive replies (list_reply or button_reply)
        if (message.type === 'interactive' && message.interactive) {
            const callbackId = message.interactive.list_reply?.id
                || message.interactive.button_reply?.id
                || '';

            await handleCallback(from, callbackId);
            return;
        }

        // Handle template quick-reply button taps
        if (message.type === 'button' && message.button?.payload) {
            await handleCallback(from, message.button.payload);
            return;
        }

        // Handle text messages — react immediately, then check for greeting / massif search
        if (message.type === 'text' && message.text?.body) {
            clearState(from);
            WhatsAppClient.react(from, message.id, '🔍').catch(() => {});
            if (await handleGreeting(from, message.text.body, message.id)) return;
            await handleTextSearch(from, message.text.body, message.id);
            return;
        }

        // Any other message type → welcome
        clearState(from);
        await sendWelcome(from);
    }

    async function handleGreeting(from: string, text: string, messageId: string): Promise<boolean> {
        const {isGreeting, remaining} = detectPleasantry(text);
        if (!isGreeting) return false;

        // Pure pleasantry — clear search reaction and send welcome
        if (!remaining) {
            WhatsAppClient.react(from, messageId, '').catch(() => {});
            Analytics.send(`WA ${from} greeting: "${text}"`).catch(console.error);
            await sendWelcome(from);
            return true;
        }

        // Greeting + extra text — try to resolve it
        const matches = MassifCache.searchByName(remaining);

        if (matches.length === 1) {
            Analytics.send(`WA ${from} greeting+search: "${text}" → ${matches[0].name}`).catch(console.error);
            await BulletinFlow.deliverAndPromptSubscribe(from, matches[0].code, {messageId});
            return true;
        }

        if (matches.length > 1) {
            // Multiple matches — clear search reaction and let the user pick
            WhatsAppClient.react(from, messageId, '').catch(() => {});
            Analytics.send(`WA ${from} greeting+search: "${text}" → ${matches.length} matches`).catch(console.error);
            const msg = Messages.multipleMatches(matches.length, remaining);
            if (matches.length <= 3) {
                await WhatsAppClient.sendReplyButtons(
                    from,
                    msg,
                    matches.map(m => ({id: `br:mas:${m.code}`, title: m.name.substring(0, 20)})),
                );
            } else {
                const rows = matches.slice(0, 10).map(m => ({
                    id: `br:mas:${m.code}`,
                    title: m.name.substring(0, 24),
                }));
                await WhatsAppClient.sendListMessage(
                    from,
                    msg,
                    'Select massif',
                    [{title: 'Results', rows}],
                );
            }
            return true;
        }

        // No massif match — try geocode
        const cached = await GeocodeCache.lookup(remaining);
        if (cached) {
            const massif = MassifCache.findByCode(cached.massifCode);
            if (massif) {
                Analytics.send(`WA ${from} greeting+geocode: "${text}" → ${massif.name} (cached)`).catch(console.error);
                await BulletinFlow.deliverAndPromptSubscribe(from, massif.code, {messageId});
                return true;
            }
        }

        const location = await geocode(remaining);
        if (location) {
            const massif = MassifCache.findByLocation(location.lat, location.lng);
            if (massif) {
                GeocodeCache.store(remaining, massif.code, location.lat, location.lng, location.formattedAddress).catch(console.error);
                Analytics.send(`WA ${from} greeting+geocode: "${text}" → ${massif.name}`).catch(console.error);
                await BulletinFlow.deliverAndPromptSubscribe(from, massif.code, {messageId});
                return true;
            }
        }

        // Couldn't resolve — clear search reaction and send welcome
        WhatsAppClient.react(from, messageId, '').catch(() => {});
        Analytics.send(`WA ${from} greeting (unresolved): "${text}"`).catch(console.error);
        await sendWelcome(from);
        return true;
    }

    async function handleTextSearch(from: string, query: string, messageId: string): Promise<void> {
        // 🔍 reaction already sent by handleMessage

        const matches = MassifCache.searchByName(query);

        if (matches.length === 0) {
            // No massif name match — check geocode cache, then fall back to API
            const cached = await GeocodeCache.lookup(query);
            if (cached) {
                const massif = MassifCache.findByCode(cached.massifCode);
                Analytics.send(`WA ${from} search: "${query}" → ${massif?.name ?? cached.massifCode} (cached geocode)`).catch(console.error);
                WhatsAppClient.react(from, messageId, '').catch(() => {
                });
                await WhatsAppClient.sendReplyButtons(
                    from,
                    Messages.geocodeConfirm(cached.formattedAddress, massif?.name ?? 'unknown'),
                    [
                        {id: `geo:yes:${cached.massifCode}`, title: 'Yes'},
                        {id: 'geo:no', title: 'No'},
                    ],
                );
                return;
            }

            const location = await geocode(query);
            if (location) {
                const massif = MassifCache.findByLocation(location.lat, location.lng);
                if (massif) {
                    // Cache for future lookups
                    GeocodeCache.store(query, massif.code, location.lat, location.lng, location.formattedAddress).catch(console.error);
                    Analytics.send(`WA ${from} search: "${query}" → ${massif.name} (geocoded)`).catch(console.error);
                    WhatsAppClient.react(from, messageId, '').catch(() => {
                    });
                    await WhatsAppClient.sendReplyButtons(
                        from,
                        Messages.geocodeConfirm(location.formattedAddress, massif.name),
                        [
                            {id: `geo:yes:${massif.code}`, title: 'Yes'},
                            {id: 'geo:no', title: 'No'},
                        ],
                    );
                } else {
                    Analytics.send(`WA ${from} search: "${query}" → no massif (geocoded but outside coverage)`).catch(console.error);
                    WhatsAppClient.react(from, messageId, '').catch(() => {
                    });
                    await WhatsAppClient.sendReplyButtons(
                        from,
                        Messages.outsideCoverage(query),
                        [{id: 'menu:browse', title: '🗺️ Browse all massifs'}],
                    );
                }
            } else {
                Analytics.send(`WA ${from} search: "${query}" → no result`).catch(console.error);
                WhatsAppClient.react(from, messageId, '').catch(() => {
                });
                await WhatsAppClient.sendReplyButtons(
                    from,
                    Messages.noResultsFor(query),
                    [{id: 'menu:browse', title: '🗺️ Browse all massifs'}],
                );
            }
            return;
        }

        if (matches.length === 1) {
            Analytics.send(`WA ${from} search: "${query}" → ${matches[0].name} (massif name)`).catch(console.error);
            await BulletinFlow.deliverAndPromptSubscribe(from, matches[0].code, {messageId});
            return;
        }

        Analytics.send(`WA ${from} search: "${query}" → ${matches.length} matches`).catch(console.error);
        // Multiple matches — let the user pick
        const msg = Messages.multipleMatches(matches.length, query);
        if (matches.length <= 3) {
            await WhatsAppClient.sendReplyButtons(
                from,
                msg,
                matches.map(m => ({id: `br:mas:${m.code}`, title: m.name.substring(0, 20)})),
            );
        } else {
            const rows = matches.slice(0, 10).map(m => ({
                id: `br:mas:${m.code}`,
                title: m.name.substring(0, 24),
            }));
            await WhatsAppClient.sendListMessage(
                from,
                msg,
                'Select massif',
                [{title: 'Results', rows}],
            );
        }

        // Clear search reaction for non-delivery paths (delivery clears its own)
        WhatsAppClient.react(from, messageId, '').catch(() => {
        });
    }

    async function handleLocation(from: string, lat: number, lng: number): Promise<void> {
        const massif = MassifCache.findByLocation(lat, lng);

        if (!massif) {
            await WhatsAppClient.sendReplyButtons(
                from,
                Messages.locationNotFound,
                [{id: 'menu:browse', title: '🗺️ Browse massifs'}],
            );
            return;
        }

        clearState(from);
        await BulletinFlow.deliverAndPromptSubscribe(from, massif.code);
    }

    async function handleCallback(from: string, callbackId: string): Promise<void> {
        // Browse massifs (from "no match" fallback)
        if (callbackId === 'menu:browse') {
            const newState = await BulletinFlow.showMountains(from);
            setState(from, newState);
            return;
        }

        // Geocode confirmation
        if (callbackId.startsWith('geo:yes:')) {
            const massifCode = parseInt(callbackId.substring('geo:yes:'.length), 10);
            if (!isNaN(massifCode)) {
                await BulletinFlow.deliverAndPromptSubscribe(from, massifCode);
            }
            clearState(from);
            return;
        }
        if (callbackId === 'geo:no') {
            const newState = await BulletinFlow.showMountains(from);
            setState(from, newState);
            return;
        }

        // Manage subscriptions
        if (callbackId === 'manage:subs') {
            await BulletinFlow.manageSubscriptions(from);
            clearState(from);
            return;
        }

        // Unsubscribe
        if (callbackId.startsWith('unsub:')) {
            const massifCode = parseInt(callbackId.substring('unsub:'.length), 10);
            if (!isNaN(massifCode)) {
                await BulletinFlow.unsubscribe(from, massifCode);
            }
            clearState(from);
            return;
        }

        // Browse flow: mountain selection
        if (callbackId.startsWith('br:mtn:')) {
            const mountain = callbackId.substring('br:mtn:'.length);
            const newState = await BulletinFlow.showMassifs(from, mountain);
            setState(from, newState);
            return;
        }

        // Browse flow: mountain pagination
        if (callbackId.startsWith('br:mtnpage:')) {
            const page = parseInt(callbackId.substring('br:mtnpage:'.length), 10);
            if (!isNaN(page)) {
                const newState = await BulletinFlow.showMountains(from, page);
                setState(from, newState);
            }
            return;
        }

        // Browse flow: massif selection → deliver bulletin
        if (callbackId.startsWith('br:mas:')) {
            const massifCode = parseInt(callbackId.substring('br:mas:'.length), 10);
            if (!isNaN(massifCode)) {
                clearState(from);
                await BulletinFlow.deliverAndPromptSubscribe(from, massifCode);
            }
            return;
        }

        // Browse flow: massif pagination
        if (callbackId.startsWith('br:maspage:')) {
            // Format: br:maspage:{mountain}:{page}
            const rest = callbackId.substring('br:maspage:'.length);
            const lastColon = rest.lastIndexOf(':');
            const mountain = rest.substring(0, lastColon);
            const page = parseInt(rest.substring(lastColon + 1), 10);
            if (!isNaN(page) && mountain) {
                const newState = await BulletinFlow.showMassifs(from, mountain, page);
                setState(from, newState);
            }
            return;
        }

        // Unknown callback → welcome
        clearState(from);
        await sendWelcome(from);
    }
}
