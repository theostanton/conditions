import {bot} from "@config/telegram";
import {Bulletin, BulletinDestination} from "@app-types";
import {Database} from "@database/queries";

export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
    const rows = await Database.getSubscriptionsByMassif();
    const destinations: BulletinDestination[] = [];

    for (const row of rows) {
        const bulletin = bulletins.find(value => value.massif == row.massif);
        if (bulletin != undefined) {
            destinations.push({
                recipients: row.recipients.split(","),
                massif: row.massif,
                filename: bulletin.filename,
                public_url: bulletin.public_url
            });
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
    const messages = destinations.flatMap(destination =>
        destination.recipients.map(recipient => ({
            recipient,
            publicUrl: destination.public_url
        }))
    );

    // Send in batches to respect Telegram rate limits
    // Telegram allows ~30 messages per second, we'll be conservative with 20
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 1000; // 1 second between batches

    const batches = chunkArray(messages, BATCH_SIZE);
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        console.log(`Sending batch ${i + 1}/${batches.length} (${batch.length} messages)`);

        const results = await Promise.allSettled(
            batch.map(msg => bot.api.sendDocument(msg.recipient, msg.publicUrl))
        );

        // Count successes and failures
        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                totalSent++;
            } else {
                totalFailed++;
                console.error(`Failed to send to ${batch[idx].recipient}:`, result.reason);
            }
        });

        // Delay before next batch (except for the last batch)
        if (i < batches.length - 1) {
            await delay(BATCH_DELAY_MS);
        }
    }

    console.log(`Sent ${totalSent} messages successfully, ${totalFailed} failed`);
    return totalSent;
}
