import {MassifCache} from "@cache/MassifCache";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {Subscriptions} from "@database/models/Subscriptions";
import {BulletinService} from "@services/bulletinService";
import {WhatsAppClient} from "@whatsapp/client";
import {Analytics} from "@analytics/Analytics";
import type {ConversationState} from "@whatsapp/router";
import type {ListRow, ListSection} from "@whatsapp/types";

const PAGE_SIZE = 9;

export namespace BulletinFlow {

    export async function showMountains(to: string, page: number = 0): Promise<Partial<ConversationState>> {
        const mountains = MassifCache.getMountains();
        const rows = paginate(
            mountains.map(m => ({id: `br:mtn:${m}`, title: m.substring(0, 24)})),
            page,
            `br:mtnpage:${page + 1}`,
        );

        const sections: ListSection[] = [{title: 'Mountain Ranges', rows}];

        await WhatsAppClient.sendListMessage(
            to,
            page > 0
                ? `Mountain ranges (page ${page + 1}):`
                : 'Choose a mountain range.',
            'Select range',
            sections,
            'Mountain Ranges',
        );

        return {step: 'select_mountain'};
    }

    export async function showMassifs(to: string, mountain: string, page: number = 0): Promise<Partial<ConversationState>> {
        const massifs = MassifCache.getByMountain(mountain);

        if (massifs.length === 0) {
            await WhatsAppClient.sendText(to, `No massifs found for ${mountain}.`);
            return {step: 'idle'};
        }

        const rows = paginate(
            massifs.map(m => ({id: `br:mas:${m.code}`, title: m.name.substring(0, 24)})),
            page,
            `br:maspage:${mountain}:${page + 1}`,
        );

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

        return {step: 'select_massif', mountain};
    }

    export async function deliverAndPromptSubscribe(to: string, massifCode: number, placeName?: string, reactTo?: {
        messageId: string
    }): Promise<void> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return;
        }

        // Get or fetch bulletin
        let bulletin = await Bulletins.getLatest(massifCode);
        if (!bulletin || bulletin.valid_to < new Date()) {
            try {
                const metadata = await BulletinService.fetchBulletinMetadata(massifCode);
                if (metadata) {
                    const fetched = await BulletinService.fetchAndStoreBulletins([{
                        massif: massifCode,
                        valid_from: metadata.validFrom,
                        valid_to: metadata.validTo,
                        risk_level: metadata.riskLevel,
                    }]);
                    if (fetched.length > 0) bulletin = fetched[0];
                }
            } catch (error) {
                console.error(`Failed to fetch bulletin for ${massif.name}:`, error);
            }
        }

        if (!bulletin) {
            await WhatsAppClient.sendText(to, `No bulletin available for ${massif.name} at this time.`);
            return;
        }


        // Send place context if geocoded
        if (placeName) {
            await WhatsAppClient.sendText(to, `Looks like ${placeName} is in the ${massif.name} massif.\nSending you the current bulletin for ${massif.name}.`);
        }

        // Update reaction to show we're sending
        if (reactTo) WhatsAppClient.react(to, reactTo.messageId, '📩').catch(() => {
        });

        // Send the PDF
        await WhatsAppClient.sendDocument(
            to,
            bulletin.public_url,
            undefined,
            bulletin.filename.replace(/^\/tmp\//, ''),
        );

        // Remove reaction now that delivery is complete
        if (reactTo) WhatsAppClient.react(to, reactTo.messageId, '').catch(() => {
        });

        // Record delivery
        try {
            await Deliveries.recordDelivery(to, bulletin, 'whatsapp');
        } catch (error) {
            console.error(`Failed to record delivery for ${to}:`, error);
        }

        // Subscribe prompt or confirmation after the PDF
        const isSubscribed = await Subscriptions.isSubscribed(to, massifCode, 'whatsapp');
        if (isSubscribed) {
            await WhatsAppClient.sendText(to, `You're already subscribed to ${massif.name} bulletins.`);
        } else {
            await WhatsAppClient.sendReplyButtons(
                to,
                `Subscribe to ${massif.name} bulletins?`,
                [{id: `sub:${massifCode}`, title: 'Subscribe'}],
            );
        }
    }

    export async function subscribe(to: string, massifCode: number): Promise<void> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return;
        }

        await Subscriptions.subscribe(to, massif, undefined, 'whatsapp');

        await WhatsAppClient.sendText(
            to,
            `Subscribed to ${massif.name}! You'll receive bulletin updates automatically.\n\nSend any message to start over.`,
        );

        Analytics.send(`WhatsApp ${to} subscribed to ${massif.name}`).catch(console.error);
    }

    export async function unsubscribe(to: string, massifCode: number): Promise<void> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return;
        }

        await Subscriptions.unsubscribe(to, massif, 'whatsapp');

        await WhatsAppClient.sendText(
            to,
            `Unsubscribed from ${massif.name}.\n\nSend any message to start over.`,
        );

        Analytics.send(`WhatsApp ${to} unsubscribed from ${massif.name}`).catch(console.error);
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
