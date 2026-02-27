import {config} from "dotenv";
import database from "./database";

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
}

const MESSAGE = `Thanks for using the Conditions bot. It is now available on WhatsApp at https://wa.me/33685594288`;

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1_000;

async function broadcast() {
    const client = await database();

    // Get all unique Telegram subscribers
    const result = await client.query<{ recipient: string }>(
        "SELECT DISTINCT recipient FROM bra_subscriptions WHERE platform = 'telegram'"
    );
    const recipients = [...result].map(r => r.recipient);

    console.log(`Found ${recipients.length} Telegram subscribers`);

    let sent = 0;
    let failed = 0;
    const failures: Array<{ recipient: string; error: string }> = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);

        console.log(`Sending batch ${batchNum}/${totalBatches} (${batch.length} messages)`);

        const results = await Promise.allSettled(
            batch.map(async (recipient) => {
                const response = await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            chat_id: recipient,
                            text: MESSAGE,
                        }),
                    }
                );

                if (!response.ok) {
                    const body = await response.json();
                    throw new Error(`${response.status}: ${JSON.stringify(body)}`);
                }
            })
        );

        for (let j = 0; j < results.length; j++) {
            if (results[j].status === 'fulfilled') {
                sent++;
            } else {
                failed++;
                const reason = (results[j] as PromiseRejectedResult).reason;
                failures.push({recipient: batch[j], error: String(reason)});
            }
        }

        // Rate limit between batches
        if (i + BATCH_SIZE < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
    }

    console.log(`\n✅ Done: ${sent} sent, ${failed} failed out of ${recipients.length} total`);

    if (failures.length > 0) {
        console.log('\nFailed recipients:');
        for (const f of failures) {
            console.log(`  ${f.recipient}: ${f.error}`);
        }
    }

    await client.end();
}

broadcast().catch(error => {
    console.error('Broadcast failed:', error);
    process.exit(1);
});
