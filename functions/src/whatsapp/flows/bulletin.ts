import {MassifCache} from "@cache/MassifCache";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {Subscriptions} from "@database/models/Subscriptions";
import {BulletinService} from "@services/bulletinService";
import {WhatsAppClient} from "@whatsapp/client";
import {sendBulletinTemplate} from "@whatsapp/flows/delivery";
import {Messages} from "@whatsapp/messages";
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
            Messages.chooseMountain(page),
            'Select range',
            sections,
            'Mountain Ranges',
        );

        return {step: 'select_mountain'};
    }

    export async function showMassifs(to: string, mountain: string, page: number = 0): Promise<Partial<ConversationState>> {
        const massifs = MassifCache.getByMountain(mountain);

        if (massifs.length === 0) {
            await WhatsAppClient.sendText(to, Messages.noMassifsInMountain(mountain));
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
            Messages.chooseMassif(mountain, page),
            'Select massif',
            sections,
            mountain.substring(0, 60),
        );

        return {step: 'select_massif', mountain};
    }

    export async function deliverAndPromptSubscribe(to: string, massifCode: number, reactTo?: {
        messageId: string
    }): Promise<void> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, Messages.massifNotFound);
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
            await WhatsAppClient.sendText(to, Messages.noBulletin(massif.name));
            return;
        }


        // Update reaction to show we're sending
        if (reactTo) WhatsAppClient.react(to, reactTo.messageId, '📩').catch(() => {
        });

        // Send the PDF via template for consistency
        await sendBulletinTemplate(to, bulletin, massif);

        // Remove reaction now that delivery is complete
        if (reactTo) WhatsAppClient.react(to, reactTo.messageId, '').catch(() => {
        });

        // Record delivery
        try {
            await Deliveries.recordDelivery(to, bulletin, 'whatsapp');
        } catch (error) {
            console.error(`Failed to record delivery for ${to}:`, error);
        }

        // Auto-subscribe and confirm with unsubscribe option
        const isSubscribed = await Subscriptions.isSubscribed(to, massifCode, 'whatsapp');
        if (!isSubscribed) {
            await Subscriptions.subscribe(to, massif, undefined, 'whatsapp');
            Analytics.send(`WhatsApp ${to} auto-subscribed to ${massif.name}`).catch(console.error);
        }
        await WhatsAppClient.sendReplyButtons(
            to,
            Messages.subscribed(massif.name),
            [{id: `unsub:${massifCode}`, title: 'Unsubscribe'}],
        );
    }

    export async function manageSubscriptions(to: string): Promise<void> {
        const subs = await Subscriptions.getAllForUser(to, 'whatsapp');

        if (subs.length === 0) {
            await WhatsAppClient.sendText(to, Messages.noSubscriptions);
            return;
        }

        if (subs.length === 1) {
            const massif = MassifCache.findByCode(subs[0].massif);
            await WhatsAppClient.sendReplyButtons(
                to,
                Messages.subscribedTo(massif?.name ?? 'a massif'),
                [{id: `unsub:${subs[0].massif}`, title: 'Unsubscribe'}],
            );
            return;
        }

        const rows: ListRow[] = subs
            .map(s => {
                const massif = MassifCache.findByCode(s.massif);
                return massif ? {id: `unsub:${s.massif}`, title: massif.name.substring(0, 24)} : null;
            })
            .filter((r): r is ListRow => r !== null);

        await WhatsAppClient.sendListMessage(
            to,
            Messages.subscribedToCount(rows.length),
            'Select massif',
            [{title: 'Your subscriptions', rows}],
        );
    }

    export async function unsubscribe(to: string, massifCode: number): Promise<void> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, Messages.massifNotFound);
            return;
        }

        await Subscriptions.unsubscribe(to, massif, 'whatsapp');

        await WhatsAppClient.sendText(
            to,
            Messages.unsubscribed(massif.name),
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
