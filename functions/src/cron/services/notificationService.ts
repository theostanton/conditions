import {bot} from "@config/telegram";
import {Bulletin, BulletinDestination} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";

export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
    const subscriptions = await Database.getSubscriptionsByMassif();
    const destinations: BulletinDestination[] = [];

    for (const subscription of subscriptions) {
        const bulletin = bulletins.find(bulletin => bulletin.massif == subscription.massif);
        if (bulletin != undefined) {

            // Filter recipients who haven't received this bulletin yet
            const subscribers = subscription.recipients.split(",");
            const filteredSubscribers: string[] = [];

            for (const subscriber of subscribers) {
                const alreadyDelivered = await Deliveries.hasBeenDelivered(
                    subscriber,
                    bulletin
                );
                if (!alreadyDelivered) {
                    filteredSubscribers.push(subscriber);
                }
            }

            // Only add destination if there are recipients who haven't received it
            if (filteredSubscribers.length > 0) {
                destinations.push({
                    recipients: filteredSubscribers,
                    massif: subscription.massif,
                    filename: bulletin.filename,
                    public_url: bulletin.public_url,
                    valid_from: bulletin.valid_from,
                    valid_to: bulletin.valid_to
                });
            }
        }
    }

    return destinations;
}

// Helper function to chunk array for batching
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Helper function to delay between batches (rate limiting)
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function send(destinations: BulletinDestination[]): Promise<number> {
    // Flatten all messages to send
    const messages = destinations.flatMap(destination => {
        // Use valid_from timestamp (milliseconds since epoch)
        return destination.recipients.map(recipient => ({
            recipient,
            publicUrl: destination.public_url,
            massif: destination.massif,
            validFrom: destination.valid_from
        }));
    });

    // Send in batches to respect Telegram rate limits
    // Telegram allows ~30 messages per second, we'll be conservative with 20
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 1_000; // 1 second between batches

    const batches = chunkArray(messages, BATCH_SIZE);
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        console.log(`Sending batch ${i + 1}/${batches.length} (${batch.length} messages)`);

        const results = await Promise.allSettled(
            batch.map(msg => bot.api.sendDocument(msg.recipient, msg.publicUrl))
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
            await delay(BATCH_DELAY_MS);
        }
    }

    console.log(`Sent ${totalSent} messages successfully, ${totalFailed} failed`);
    return totalSent;
}
