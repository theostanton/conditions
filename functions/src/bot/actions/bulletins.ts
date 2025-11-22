import {Context} from "grammy";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {Bulletin, Massif} from "@app-types";
import {BulletinService} from "@cron/services/bulletinService";

export namespace ActionBulletins {

    async function fetchAndStoreBulletin(massif: Massif, context: Context): Promise<Bulletin | undefined> {
        const message = await context.reply(`Fetching latest bulletin for ${massif.name}...`);

        try {
            const metadata = await BulletinService.fetchBulletinMetadata(massif.code);

            if (!metadata) {
                await context.reply(`Currently no bulletin available for ${massif.name}`);
                return undefined;
            }

            const bulletins = await BulletinService.fetchAndStoreBulletins([{
                massif: massif.code,
                valid_from: metadata.validFrom,
                valid_to: metadata.validTo,
                risk_level: metadata.riskLevel
            }]);

            if (bulletins.length === 0) {
                await context.reply(`Failed to fetch bulletin for ${massif.name}`);
                return undefined;
            }

            return bulletins[0];
        } catch (error) {
            console.error('Error fetching bulletin:', error);
            await context.reply(`Failed to fetch bulletin for ${massif.name}. Please try again.`);
            return undefined;
        }
    }

    async function deliverBulletin(
        context: Context,
        massif: Massif,
        bulletin: Bulletin,
        recipient: string
    ): Promise<void> {
        await context.replyWithDocument(bulletin.public_url);

        if (bulletin.valid_to < new Date()) {
            await context.reply(`Latest bulletin for ${massif.name} is outdated`);
        }

        await Deliveries.recordDelivery(recipient, bulletin);
    }

    export async function send(context: Context, massif: Massif, force: boolean): Promise<void> {
        try {
            let bulletin = await Bulletins.getLatest(massif.code);

            if (bulletin === undefined || bulletin.valid_to < new Date()) {
                bulletin = await fetchAndStoreBulletin(massif, context);
                if (!bulletin) {
                    return;
                }
            }

            const recipient = context.from?.id?.toString();
            if (!recipient) {
                await context.reply('Unable to identify recipient');
                return;
            }

            if (!force) {
                const alreadyDelivered = await Deliveries.hasBeenDelivered(recipient, bulletin);
                if (alreadyDelivered) {
                    return;
                }
            }

            await deliverBulletin(context, massif, bulletin, recipient);

        } catch (error) {
            console.error('Error sending bulletin:', error);
            await context.reply(`Failed to retrieve bulletin for ${massif.name}. Please try again.`);
        }
    }
}
