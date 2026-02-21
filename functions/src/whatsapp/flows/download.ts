import {ContentTypes} from "@app-types";
import {MassifCache} from "@cache/MassifCache";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {BulletinService} from "@services/bulletinService";
import {WhatsAppClient} from "@whatsapp/client";
import {WhatsAppDelivery} from "@whatsapp/flows/delivery";
import type {ConversationState} from "@whatsapp/router";
import type {ListRow, ListSection} from "@whatsapp/types";
import {CONTENT_TYPE_CONFIGS} from "@constants/contentTypes";

const PAGE_SIZE = 9; // 9 items + 1 "More" row = 10 max

export namespace DownloadFlow {

    export async function showMountains(to: string, page: number = 0): Promise<Partial<ConversationState>> {
        const mountains = MassifCache.getMountains();
        const {rows, hasMore} = paginate(
            mountains.map(m => ({id: `dl:mtn:${m}`, title: m.substring(0, 24)})),
            page,
            `dl:mtnpage:${page + 1}`,
        );

        const sections: ListSection[] = [{title: 'Mountain Ranges', rows}];

        await WhatsAppClient.sendListMessage(
            to,
            page > 0
                ? `Mountain ranges (page ${page + 1}):`
                : 'Choose a mountain range to download conditions from.',
            'Select range',
            sections,
            'Mountain Ranges',
        );

        return {step: 'select_mountain', action: 'download'};
    }

    export async function showMassifs(to: string, mountain: string, page: number = 0): Promise<Partial<ConversationState>> {
        const massifs = MassifCache.getByMountain(mountain);

        if (massifs.length === 0) {
            await WhatsAppClient.sendText(to, `No massifs found for ${mountain}.`);
            return {step: 'idle'};
        }

        const {rows, hasMore} = paginate(
            massifs.map(m => ({id: `dl:mas:${m.code}`, title: m.name.substring(0, 24)})),
            page,
            `dl:maspage:${mountain}:${page + 1}`,
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

        return {step: 'select_massif', action: 'download', mountain};
    }

    export async function showContentTypes(to: string, massifCode: number): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        const sections: ListSection[] = [{
            title: 'Content Types',
            rows: [
                {id: `dl:cnt:all`, title: 'All Content', description: 'Bulletin + all images'},
                ...CONTENT_TYPE_CONFIGS.map(c => ({
                    id: `dl:cnt:${c.key}`,
                    title: `${c.emoji} ${c.label}`.substring(0, 24),
                    description: c.label,
                })),
            ],
        }];

        await WhatsAppClient.sendListMessage(
            to,
            `What content would you like for ${massif.name}?`,
            'Select content',
            sections,
            massif.name.substring(0, 60),
        );

        return {step: 'select_content', action: 'download', massifCode};
    }

    export async function deliver(to: string, massifCode: number, contentKey: string): Promise<Partial<ConversationState>> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif) {
            await WhatsAppClient.sendText(to, 'Massif not found.');
            return {step: 'idle'};
        }

        // Build content types
        let contentTypes: ContentTypes;
        if (contentKey === 'all') {
            contentTypes = {
                bulletin: true, snow_report: true, fresh_snow: true,
                weather: true, last_7_days: true, rose_pentes: true, montagne_risques: true,
            };
        } else {
            contentTypes = {
                bulletin: false, snow_report: false, fresh_snow: false,
                weather: false, last_7_days: false, rose_pentes: false, montagne_risques: false,
            };
            if (contentKey in contentTypes) {
                contentTypes[contentKey as keyof ContentTypes] = true;
            } else {
                contentTypes.bulletin = true;
            }
        }

        // Get or fetch bulletin
        let bulletin = await Bulletins.getLatest(massifCode);
        if (!bulletin || bulletin.valid_to < new Date()) {
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
        }

        if (!bulletin) {
            await WhatsAppClient.sendText(to, `No bulletin available for ${massif.name} at this time.`);
            return {step: 'idle'};
        }

        // Deliver content
        await WhatsAppDelivery.sendBulletinWithContent(to, bulletin, massif, contentTypes);

        // Record delivery
        try {
            await Deliveries.recordDelivery(to, bulletin, 'whatsapp');
        } catch (error) {
            console.error(`Failed to record delivery for ${to}:`, error);
        }

        // Offer subscription
        await WhatsAppDelivery.sendSubscriptionPrompt(to, massif);

        return {step: 'idle'};
    }
}

function paginate(allRows: ListRow[], page: number, nextPageId: string): {rows: ListRow[]; hasMore: boolean} {
    const start = page * PAGE_SIZE;
    const slice = allRows.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < allRows.length;

    if (hasMore) {
        slice.push({id: nextPageId, title: 'More →'});
    }

    return {rows: slice, hasMore};
}
