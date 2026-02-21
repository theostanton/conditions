import {ContentTypes} from "@app-types";
import {MassifCache} from "@cache/MassifCache";
import {Subscriptions} from "@database/models/Subscriptions";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {BulletinService} from "@services/bulletinService";
import {WhatsAppClient} from "@whatsapp/client";
import {WhatsAppDelivery} from "@whatsapp/flows/delivery";
import type {ConversationState} from "@whatsapp/router";
import type {ListRow, ListSection} from "@whatsapp/types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";
import {Analytics} from "@analytics/Analytics";

const PAGE_SIZE = 9; // 9 items + 1 "More" row = 10 max

export namespace SubscribeFlow {

    export async function showMountains(to: string, page: number = 0): Promise<Partial<ConversationState>> {
        const mountains = MassifCache.getMountains();

        const rows = paginate(
            mountains.map(m => ({id: `sub:mtn:${m}`, title: m.substring(0, 24)})),
            page,
            `sub:mtnpage:${page + 1}`,
        );

        const sections: ListSection[] = [{title: 'Mountain Ranges', rows}];

        await WhatsAppClient.sendListMessage(
            to,
            page > 0
                ? `Mountain ranges (page ${page + 1}):`
                : 'Choose a mountain range to manage subscriptions.',
            'Select range',
            sections,
            'Subscriptions',
        );

        return {step: 'select_mountain', action: 'subscribe'};
    }

    export async function showMassifs(to: string, mountain: string, page: number = 0): Promise<Partial<ConversationState>> {
        const massifs = MassifCache.getByMountain(mountain);

        if (massifs.length === 0) {
            await WhatsAppClient.sendText(to, `No massifs found for ${mountain}.`);
            return {step: 'idle'};
        }

        // Check subscription statuses
        const statuses = await Subscriptions.getSubscriptionStatuses(
            to, massifs.map(m => m.code), 'whatsapp'
        );

        const allRows = massifs.map(m => {
            const subscribed = statuses.get(m.code) || false;
            return {
                id: `sub:mas:${m.code}`,
                title: m.name.substring(0, 24),
                description: subscribed ? 'Subscribed' : 'Not subscribed',
            };
        });

        const rows = paginate(allRows, page, `sub:maspage:${mountain}:${page + 1}`);
        const sections: ListSection[] = [{title: mountain.substring(0, 24), rows}];

        await WhatsAppClient.sendListMessage(
            to,
            page > 0
                ? `Massifs in ${mountain} (page ${page + 1}):`
                : `Choose a massif in ${mountain}.`,
            'Select massif',
            sections,
            mountain.substring(0, 60),
        );

        return {step: 'select_massif', action: 'subscribe', mountain};
    }

    export async function showMassifActions(to: string, massifCode: number): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        const isSubscribed = await Subscriptions.isSubscribed(to, massifCode, 'whatsapp');

        if (isSubscribed) {
            await WhatsAppClient.sendReplyButtons(
                to,
                `You're subscribed to ${massif.name}. What would you like to do?`,
                [
                    {id: `sub:manage:${massifCode}`, title: 'Manage'},
                    {id: `sub:unsub:${massifCode}`, title: 'Unsubscribe'},
                    {id: 'sub:cancel', title: 'Cancel'},
                ],
            );
        } else {
            await WhatsAppClient.sendReplyButtons(
                to,
                `Subscribe to ${massif.name} bulletins?`,
                [
                    {id: `sub:all:${massifCode}`, title: 'Subscribe (all)'},
                    {id: `sub:choose:${massifCode}`, title: 'Choose content'},
                    {id: 'sub:cancel', title: 'Cancel'},
                ],
            );
        }

        return {step: 'select_content', action: 'subscribe', massifCode};
    }

    export async function subscribeAll(to: string, massifCode: number): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        await Subscriptions.subscribe(to, massif, undefined, 'whatsapp');

        await WhatsAppClient.sendText(to, `Subscribed to ${massif.name}! You'll receive bulletin updates automatically.`);

        // Send latest bulletin as welcome
        await sendWelcomeBulletin(to, massif);

        Analytics.send(`WhatsApp ${to} subscribed to ${massif.name} (all content)`).catch(console.error);

        return {step: 'idle'};
    }

    export async function showContentTypeSelection(to: string, massifCode: number, currentTypes?: Partial<ContentTypes>): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        const types = currentTypes || {bulletin: true};

        const sections: ListSection[] = [{
            title: 'Content Types',
            rows: [
                ...CONTENT_TYPE_CONFIGS.map(c => ({
                    id: `sub:toggle:${massifCode}:${c.key}`,
                    title: `${types[c.key] ? '☑' : '☐'} ${c.label}`.substring(0, 24),
                    description: c.label,
                })),
                {id: `sub:done:${massifCode}`, title: 'Done - Save', description: 'Save your content preferences'},
            ],
        }];

        await WhatsAppClient.sendListMessage(
            to,
            `Select content types for ${massif.name}. Tap to toggle, then tap "Done - Save".`,
            'Select',
            sections,
            massif.name.substring(0, 60),
        );

        return {step: 'select_sub_content', action: 'subscribe', massifCode, contentTypes: types};
    }

    export async function toggleContentType(
        to: string,
        massifCode: number,
        contentKey: string,
        currentTypes: Partial<ContentTypes>,
    ): Promise<Partial<ConversationState>> {
        const updated = {...currentTypes};
        if (contentKey in updated) {
            (updated as any)[contentKey] = !(updated as any)[contentKey];
        } else {
            (updated as any)[contentKey] = true;
        }

        // Re-show the content type selection with updated state
        return showContentTypeSelection(to, massifCode, updated);
    }

    export async function saveSubscription(to: string, massifCode: number, contentTypes: Partial<ContentTypes>): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        await Subscriptions.subscribe(to, massif, contentTypes, 'whatsapp');

        await WhatsAppClient.sendText(to, `Subscribed to ${massif.name}! Your content preferences have been saved.`);

        await sendWelcomeBulletin(to, massif);

        Analytics.send(`WhatsApp ${to} subscribed to ${massif.name} with types: ${JSON.stringify(contentTypes)}`).catch(console.error);

        return {step: 'idle'};
    }

    export async function unsubscribe(to: string, massifCode: number): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        await Subscriptions.unsubscribe(to, massif, 'whatsapp');

        await WhatsAppClient.sendText(to, `Unsubscribed from ${massif.name}.`);

        Analytics.send(`WhatsApp ${to} unsubscribed from ${massif.name}`).catch(console.error);

        return {step: 'idle'};
    }

    export async function manageSubscription(to: string, massifCode: number): Promise<Partial<ConversationState>> {
        const subscription = await Subscriptions.getSubscription(to, massifCode, 'whatsapp');
        if (!subscription) {
            await WhatsAppClient.sendText(to, 'Subscription not found.');
            return {step: 'idle'};
        }

        return showContentTypeSelection(to, massifCode, {
            bulletin: subscription.bulletin,
            snow_report: subscription.snow_report,
            fresh_snow: subscription.fresh_snow,
            weather: subscription.weather,
            last_7_days: subscription.last_7_days,
            rose_pentes: subscription.rose_pentes,
            montagne_risques: subscription.montagne_risques,
        });
    }

    async function sendWelcomeBulletin(to: string, massif: {code: number; name: string}): Promise<void> {
        try {
            let bulletin = await Bulletins.getLatest(massif.code);
            if (!bulletin || bulletin.valid_to < new Date()) {
                const metadata = await BulletinService.fetchBulletinMetadata(massif.code);
                if (metadata) {
                    const fetched = await BulletinService.fetchAndStoreBulletins([{
                        massif: massif.code,
                        valid_from: metadata.validFrom,
                        valid_to: metadata.validTo,
                        risk_level: metadata.riskLevel,
                    }]);
                    if (fetched.length > 0) bulletin = fetched[0];
                }
            }
            if (bulletin) {
                await WhatsAppDelivery.sendBulletinWithContent(to, bulletin, massif as any, {bulletin: true});
                await Deliveries.recordDelivery(to, bulletin, 'whatsapp');
            }
        } catch (error) {
            console.error(`Failed to send welcome bulletin to ${to}:`, error);
        }
    }
}

function paginate(allRows: ListRow[], page: number, nextPageId: string): ListRow[] {
    const start = page * PAGE_SIZE;
    const slice = allRows.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < allRows.length;

    if (hasMore) {
        slice.push({id: nextPageId, title: 'More →'});
    }

    return slice;
}
