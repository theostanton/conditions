import {Context} from "grammy";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {Bulletin, ContentTypes, Massif} from "@app-types";
import {BulletinService} from "@services/bulletinService";
import {ContentDeliveryService} from "@services/contentDeliveryService";
import {BotMessages} from "@bot/messages";

export namespace ActionBulletins {

    async function fetchAndStoreBulletin(massif: Massif, context: Context): Promise<Bulletin | undefined> {
        const message = await context.reply(BotMessages.status.fetchingBulletin(massif.name));

        try {
            const metadata = await BulletinService.fetchBulletinMetadata(massif.code);

            if (!metadata) {
                await context.reply(BotMessages.status.noBulletinAvailable(massif.name));
                return undefined;
            }

            const bulletins = await BulletinService.fetchAndStoreBulletins([{
                massif: massif.code,
                valid_from: metadata.validFrom,
                valid_to: metadata.validTo,
                risk_level: metadata.riskLevel
            }]);

            if (bulletins.length === 0) {
                await context.reply(BotMessages.errors.fetchBulletinFailed(massif.name));
                return undefined;
            }

            return bulletins[0];
        } catch (error) {
            console.error('Error fetching bulletin:', error);
            await context.reply(BotMessages.errors.fetchBulletinRetry(massif.name));
            return undefined;
        }
    }

    async function deliverBulletin(
        context: Context,
        massif: Massif,
        bulletin: Bulletin,
        recipient: string,
        contentTypes: ContentTypes
    ): Promise<void> {
        // Use centralized content delivery with specified content types
        await ContentDeliveryService.sendWithContext(context, bulletin, massif, contentTypes);
        await Deliveries.recordDelivery(recipient, bulletin);
    }

    export async function send(context: Context, massif: Massif, force: boolean, contentTypes: ContentTypes): Promise<void> {
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
                await context.reply(BotMessages.errors.unableToIdentifyRecipient);
                return;
            }

            if (!force) {
                const alreadyDelivered = await Deliveries.hasBeenDelivered(recipient, bulletin);
                if (alreadyDelivered) {
                    return;
                }
            }

            await deliverBulletin(context, massif, bulletin, recipient, contentTypes);

        } catch (error) {
            console.error('Error sending bulletin:', error);
            await context.reply(BotMessages.errors.retrieveBulletinRetry(massif.name));
        }
    }
}
