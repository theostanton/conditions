import {ContentTypes} from "@app-types";
import {MassifCache} from "@cache/MassifCache";
import {WhatsAppClient} from "@whatsapp/client";
import {DownloadFlow} from "@whatsapp/flows/download";
import {SubscribeFlow} from "@whatsapp/flows/subscribe";
import {Subscriptions} from "@database/models/Subscriptions";
import type {WAWebhookPayload, WAMessage} from "@whatsapp/types";
import {Analytics} from "@analytics/Analytics";

export interface ConversationState {
    step: 'idle' | 'select_mountain' | 'select_massif' | 'select_content' | 'select_sub_content';
    action?: 'download' | 'subscribe';
    mountain?: string;
    massifCode?: number;
    contentTypes?: Partial<ContentTypes>;
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

async function sendWelcome(to: string): Promise<void> {
    await WhatsAppClient.sendReplyButtons(
        to,
        'Welcome to Conditions! I can send you French avalanche bulletins from Météo France.\n\nWhat would you like to do?',
        [
            {id: 'menu:download', title: 'Download'},
            {id: 'menu:subscribe', title: 'Subscribe'},
            {id: 'menu:help', title: 'Help'},
        ],
    );
}

async function sendHelp(to: string): Promise<void> {
    await WhatsAppClient.sendText(
        to,
        '📋 *Conditions Bot Help*\n\n'
        + '*Download* — Get the latest avalanche bulletin for any massif.\n\n'
        + '*Subscribe* — Receive automatic bulletin updates when new conditions are published.\n\n'
        + 'Send any message to return to the main menu.',
    );
}

export namespace WhatsAppRouter {

    export async function handleWebhook(payload: WAWebhookPayload): Promise<void> {
        if (payload.object !== 'whatsapp_business_account') return;

        // Periodic cleanup of stale conversation states
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
                            await WhatsAppClient.sendText(message.from, 'Something went wrong. Please try again.');
                        } catch {}
                    }
                }
            }
        }
    }

    async function handleMessage(message: WAMessage): Promise<void> {
        const from = message.from;

        // Mark as read
        await WhatsAppClient.markAsRead(message.id).catch(() => {});

        // Handle text messages
        if (message.type === 'text') {
            clearState(from);
            await sendWelcome(from);
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

        // For any other message type, show welcome
        clearState(from);
        await sendWelcome(from);
    }

    async function handleCallback(from: string, callbackId: string): Promise<void> {
        // Menu buttons
        if (callbackId === 'menu:download') {
            const newState = await DownloadFlow.showMountains(from);
            setState(from, newState);
            return;
        }

        if (callbackId === 'menu:subscribe') {
            const newState = await SubscribeFlow.showMountains(from);
            setState(from, newState);
            return;
        }

        if (callbackId === 'menu:help') {
            clearState(from);
            await sendHelp(from);
            return;
        }

        // Cancel
        if (callbackId === 'sub:cancel') {
            clearState(from);
            await sendWelcome(from);
            return;
        }

        // Quick subscribe from download flow prompt
        if (callbackId.startsWith('sub_quick:')) {
            const value = callbackId.substring('sub_quick:'.length);
            if (value === 'no') {
                clearState(from);
                return;
            }
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.subscribeAll(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        // Download flow callbacks (dl:...)
        if (callbackId.startsWith('dl:')) {
            await handleDownloadCallback(from, callbackId);
            return;
        }

        // Subscribe flow callbacks (sub:...)
        if (callbackId.startsWith('sub:')) {
            await handleSubscribeCallback(from, callbackId);
            return;
        }

        // Unknown callback
        clearState(from);
        await sendWelcome(from);
    }

    async function handleDownloadCallback(from: string, callbackId: string): Promise<void> {
        const parts = callbackId.split(':');
        const subtype = parts[1]; // mtn, mas, cnt, mtnpage, maspage
        const value = parts.slice(2).join(':');

        if (subtype === 'mtn') {
            const newState = await DownloadFlow.showMassifs(from, value);
            setState(from, newState);
            return;
        }

        if (subtype === 'mtnpage') {
            const page = parseInt(value, 10);
            if (!isNaN(page)) {
                const newState = await DownloadFlow.showMountains(from, page);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'mas') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await DownloadFlow.showContentTypes(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'maspage') {
            // Format: dl:maspage:{mountain}:{page}
            const page = parseInt(parts[parts.length - 1], 10);
            const mountain = parts.slice(2, parts.length - 1).join(':');
            if (!isNaN(page) && mountain) {
                const newState = await DownloadFlow.showMassifs(from, mountain, page);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'cnt') {
            const state = getState(from);
            if (state.massifCode) {
                const newState = await DownloadFlow.deliver(from, state.massifCode, value);
                setState(from, newState);
            }
            return;
        }
    }

    async function handleSubscribeCallback(from: string, callbackId: string): Promise<void> {
        const parts = callbackId.split(':');
        const subtype = parts[1]; // mtn, mas, all, choose, toggle, done, unsub, manage, mtnpage, maspage
        const value = parts.slice(2).join(':');

        if (subtype === 'mtn') {
            const newState = await SubscribeFlow.showMassifs(from, value);
            setState(from, newState);
            return;
        }

        if (subtype === 'mtnpage') {
            const page = parseInt(value, 10);
            if (!isNaN(page)) {
                const newState = await SubscribeFlow.showMountains(from, page);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'maspage') {
            // Format: sub:maspage:{mountain}:{page}
            const page = parseInt(parts[parts.length - 1], 10);
            const mountain = parts.slice(2, parts.length - 1).join(':');
            if (!isNaN(page) && mountain) {
                const newState = await SubscribeFlow.showMassifs(from, mountain, page);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'mas') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.showMassifActions(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'all') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.subscribeAll(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'choose') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.showContentTypeSelection(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'toggle') {
            // Format: sub:toggle:{massifCode}:{contentKey}
            const massifCode = parseInt(parts[2], 10);
            const contentKey = parts[3];
            if (!isNaN(massifCode) && contentKey) {
                const state = getState(from);
                const currentTypes = state.contentTypes || {bulletin: true};
                const newState = await SubscribeFlow.toggleContentType(from, massifCode, contentKey, currentTypes);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'done') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const state = getState(from);
                const contentTypes = state.contentTypes || {bulletin: true};
                const newState = await SubscribeFlow.saveSubscription(from, massifCode, contentTypes);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'unsub') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.unsubscribe(from, massifCode);
                setState(from, newState);
            }
            return;
        }

        if (subtype === 'manage') {
            const massifCode = parseInt(value, 10);
            if (!isNaN(massifCode)) {
                const newState = await SubscribeFlow.manageSubscription(from, massifCode);
                setState(from, newState);
            }
            return;
        }
    }
}
