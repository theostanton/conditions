import {bot} from "@config/telegram";
import {Bulletin, BulletinDestination, Subscription} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";
import {ArrayUtils} from "@utils/array";
import {AsyncUtils} from "@utils/async";
import {ContentDeliveryService} from "@services/contentDeliveryService";
import {MassifCache} from "@cache/MassifCache";

export namespace NotificationService {

    export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
        const subscriptions = await Database.getSubscriptionsByMassif();
        const destinations: BulletinDestination[] = [];

        for (const subscription of subscriptions) {
            const bulletin = bulletins.find(bulletin => bulletin.massif == subscription.massif);
            if (bulletin != undefined) {
                const subscribers = subscription.recipients.split(",");

                // Get recipients who haven't received this bulletin yet
                const undeliveredRecipients = await Deliveries.getUndeliveredRecipients(subscribers, bulletin);

                // Only add destination if there are recipients who haven't received it
                if (undeliveredRecipients.length > 0) {
                    // Get full subscription details with content_types for these recipients
                    const subscriptionsWithContentTypes = await Database.getSubscriptionsByRecipients(
                        undeliveredRecipients,
                        subscription.massif
                    );

                    destinations.push({
                        recipients: undeliveredRecipients,
                        massif: subscription.massif,
                        filename: bulletin.filename,
                        public_url: bulletin.public_url,
                        valid_from: bulletin.valid_from,
                        valid_to: bulletin.valid_to,
                        subscriptions: subscriptionsWithContentTypes
                    });
                }
            }
        }

        return destinations;
    }

    export async function send(destinations: BulletinDestination[]): Promise<number> {
        // Flatten all messages to send with their subscription details
        const messages = destinations.flatMap(destination => {
            // Build bulletin object once for this destination
            const bulletin: Bulletin = {
                massif: destination.massif,
                filename: destination.filename,
                public_url: destination.public_url,
                valid_from: destination.valid_from,
                valid_to: destination.valid_to
            };

            return destination.recipients.map(recipient => {
                const subscription = destination.subscriptions.find(s => s.recipient.toString() === recipient);
                return {
                    recipient,
                    bulletin,
                    massif: destination.massif,
                    subscription: subscription
                };
            });
        });

        // Send in batches to respect Telegram rate limits
        // Telegram allows ~30 messages per second, we'll be conservative with 20
        const BATCH_SIZE = 20;
        const BATCH_DELAY_MS = 1_000; // 1 second between batches

        const batches = ArrayUtils.chunk(messages, BATCH_SIZE);
        let totalSent = 0;
        let totalFailed = 0;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            console.log(`Sending batch ${i + 1}/${batches.length} (${batch.length} messages)`);

            const results = await Promise.allSettled(
                batch.map(msg => sendBulletinWithContent(msg))
            );

            // Process results and track deliveries
            for (let idx = 0; idx < results.length; idx++) {
                const result = results[idx];
                const msg = batch[idx];

                if (result.status === 'fulfilled') {
                    totalSent++;
                    // Record successful delivery
                    try {
                        await Deliveries.recordDelivery(msg.recipient, msg.bulletin);
                    } catch (error) {
                        console.error(`Failed to record delivery for ${msg.recipient}:`, error);
                    }
                } else {
                    totalFailed++;
                    console.error(`Failed to send to ${msg.recipient}:`, result.reason);
                }
            }

            // Delay before next batch (except for the last batch)
            if (i < batches.length - 1) {
                await AsyncUtils.delay(BATCH_DELAY_MS);
            }
        }

        console.log(`Sent ${totalSent} messages successfully, ${totalFailed} failed`);
        return totalSent;
    }

    async function sendBulletinWithContent(message: {
        recipient: string,
        bulletin: Bulletin,
        massif: number,
        subscription?: Subscription
    }): Promise<void> {
        const massif = MassifCache.findByCode(message.massif);
        if (!massif) {
            throw new Error(`Massif ${message.massif} not found`);
        }

        // Use subscription content types or default to bulletin only
        const contentTypes = message.subscription || { bulletin: true };

        await ContentDeliveryService.sendWithBotApi(bot, message.recipient, message.bulletin, massif, contentTypes);
    }
}
