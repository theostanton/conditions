import {Context} from "grammy";
import {Bulletins} from "@database/models/Bulletins";
import {Deliveries} from "@database/models/Deliveries";
import {Massif} from "@app-types";

export namespace ActionBulletins {

    export async function send(context: Context, massif: Massif, force: boolean): Promise<void> {
        try {
            const bulletin = await Bulletins.getLatest(massif.code);

            if (bulletin === undefined) {
                await context.reply(`No bulletin for ${massif.name}`);
                return;
            }

            // Get recipient ID from context
            const recipient = context.from?.id?.toString();
            if (!recipient) {
                await context.reply('Unable to identify recipient');
                return;
            }

            // Check if bulletin has already been delivered to this recipient
            if (!force) {
                const alreadyDelivered = await Deliveries.hasBeenDelivered(
                    recipient,
                    bulletin
                );

                if (alreadyDelivered) {
                    return;
                }
            }

            // Send the bulletin
            await context.replyWithDocument(bulletin.public_url);
            if (bulletin.valid_to < new Date()) {
                await context.reply(`Latest bulletin for ${massif.name} is outdated`);
            }

            // Record the delivery
            await Deliveries.recordDelivery(recipient, bulletin);

        } catch (error) {
            console.error('Error sending bulletin:', error);
            await context.reply(`Failed to retrieve bulletin for ${massif.name}. Please try again.`);
        }
    }
}
