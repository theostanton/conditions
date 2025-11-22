import {bot} from "@config/telegram";
import {Bulletin, BulletinDestination, Subscription} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";
import {ArrayUtils} from "@utils/array";
import {AsyncUtils} from "@utils/async";
import {ImageService} from "./imageService";
import {InputMediaBuilder} from "grammy";

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
            return destination.recipients.map(recipient => {
                const subscription = destination.subscriptions.find(s => s.recipient.toString() === recipient);
                return {
                    recipient,
                    publicUrl: destination.public_url,
                    massif: destination.massif,
                    validFrom: destination.valid_from,
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
                batch.map(msg => sendBulletinWithImages(msg.recipient, msg.publicUrl, msg.massif, msg.subscription))
            );

            // Process results and track deliveries
            for (let idx = 0; idx < results.length; idx++) {
                const result = results[idx];
                const msg = batch[idx];

                if (result.status === 'fulfilled') {
                    totalSent++;
                    // Record successful delivery
                    try {
                        await Deliveries.recordDelivery(msg.recipient, {
                            massif: msg.massif,
                            valid_from: msg.validFrom
                        });
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

    async function sendBulletinWithImages(
        recipient: string,
        bulletinUrl: string,
        massifCode: number,
        subscription?: Subscription
    ): Promise<void> {
        // If no subscription data or only bulletin is enabled, send just the PDF
        if (!subscription || !hasAnyImageContentType(subscription)) {
            await bot.api.sendDocument(recipient, bulletinUrl);
            return;
        }

        // Get image URLs based on enabled content types
        const imageUrls = ImageService.buildImageUrls(massifCode, subscription);

        // If no images to send, just send the bulletin
        if (imageUrls.length === 0) {
            await bot.api.sendDocument(recipient, bulletinUrl);
            return;
        }

        // Send bulletin first
        await bot.api.sendDocument(recipient, bulletinUrl);

        // Then send images as a media group
        const mediaGroup = imageUrls.map(url => InputMediaBuilder.photo(url));
        await bot.api.sendMediaGroup(recipient, mediaGroup);
    }

    function hasAnyImageContentType(subscription: Subscription): boolean {
        return subscription.snow_report ||
               subscription.fresh_snow ||
               subscription.weather ||
               subscription.last_7_days;
    }
}
