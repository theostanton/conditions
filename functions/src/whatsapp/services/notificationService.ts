import {Bulletin, BulletinDestination, Subscription} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";
import {ArrayUtils} from "@utils/array";
import {AsyncUtils} from "@utils/async";
import {WhatsAppDelivery} from "@whatsapp/flows/delivery";
import {WhatsAppClient} from "@whatsapp/client";
import {Messages} from "@whatsapp/messages";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";

export namespace WhatsappNotificationService {

    export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
        const subscriptions = await Database.getSubscriptionsByMassif('whatsapp');
        const destinations: BulletinDestination[] = [];

        for (const subscription of subscriptions) {
            const bulletin = bulletins.find(b => b.massif == subscription.massif);
            if (bulletin != undefined) {
                const subscribers = subscription.recipients.split(",");

                const undeliveredRecipients = await Deliveries.getUndeliveredRecipients(subscribers, bulletin, 'whatsapp');

                if (undeliveredRecipients.length > 0) {
                    const subscriptionsWithContentTypes = await Database.getSubscriptionsByRecipients(
                        undeliveredRecipients,
                        subscription.massif,
                        'whatsapp'
                    );

                    destinations.push({
                        recipients: undeliveredRecipients,
                        massif: subscription.massif,
                        filename: bulletin.filename,
                        public_url: bulletin.public_url,
                        valid_from: bulletin.valid_from,
                        valid_to: bulletin.valid_to,
                        risk_level: bulletin.risk_level,
                        subscriptions: subscriptionsWithContentTypes,
                    });
                }
            }
        }

        return destinations;
    }

    export async function send(destinations: BulletinDestination[]): Promise<number> {
        const messages = destinations.flatMap(destination => {
            const bulletin: Bulletin = {
                massif: destination.massif,
                filename: destination.filename.replace(/^\/tmp\//, ''),
                public_url: destination.public_url,
                valid_from: destination.valid_from,
                valid_to: destination.valid_to,
                risk_level: destination.risk_level,
            };

            return destination.recipients.map(recipient => {
                const subscription = destination.subscriptions.find(s => s.recipient === recipient);
                return {recipient, bulletin, massif: destination.massif, subscription};
            });
        });

        // More conservative rate limiting than Telegram (WhatsApp Cloud API)
        const BATCH_SIZE = 10;
        const BATCH_DELAY_MS = 1_000;

        const batches = ArrayUtils.chunk(messages, BATCH_SIZE);
        let totalSent = 0;
        let totalFailed = 0;
        const failedRecipients: Array<{recipient: string; massif: number; error: any}> = [];
        const recordingFailures: Array<{recipient: string; error: any}> = [];

        // Track which recipients received bulletins successfully (for follow-up messages)
        const recipientDeliveries = new Map<string, number[]>();

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            console.log(`[WhatsApp] Sending batch ${i + 1}/${batches.length} (${batch.length} messages)`);

            const results = await Promise.allSettled(
                batch.map(msg => sendBulletinToRecipient(msg))
            );

            for (let idx = 0; idx < results.length; idx++) {
                const result = results[idx];
                const msg = batch[idx];

                if (result.status === 'fulfilled') {
                    totalSent++;

                    // Track massifs delivered to this recipient
                    const delivered = recipientDeliveries.get(msg.recipient) || [];
                    delivered.push(msg.massif);
                    recipientDeliveries.set(msg.recipient, delivered);

                    try {
                        await Deliveries.recordDelivery(msg.recipient, msg.bulletin, 'whatsapp');
                    } catch (error) {
                        console.error(`[WhatsApp] Failed to record delivery for ${msg.recipient}:`, error);
                        recordingFailures.push({recipient: msg.recipient, error});
                    }
                } else {
                    totalFailed++;
                    console.error(`[WhatsApp] Failed to send to ${msg.recipient}:`, result.reason);
                    failedRecipients.push({
                        recipient: msg.recipient,
                        massif: msg.massif,
                        error: result.reason,
                    });
                }
            }

            if (i < batches.length - 1) {
                await AsyncUtils.delay(BATCH_DELAY_MS);
            }
        }

        // Send one follow-up per recipient
        for (const [recipient, massifCodes] of recipientDeliveries) {
            try {
                if (massifCodes.length === 1) {
                    const massif = MassifCache.findByCode(massifCodes[0]);
                    await WhatsAppClient.sendReplyButtons(
                        recipient,
                        Messages.bulletinUpdate(massif?.name ?? 'your massif'),
                        [{id: `unsub:${massifCodes[0]}`, title: 'Unsubscribe'}],
                    );
                } else {
                    const names = massifCodes
                        .map(code => MassifCache.findByCode(code)?.name)
                        .filter(Boolean) as string[];
                    await WhatsAppClient.sendReplyButtons(
                        recipient,
                        Messages.bulletinUpdates(names),
                        [{id: 'manage:subs', title: 'Manage subscriptions'}],
                    );
                }
            } catch (error) {
                console.error(`[WhatsApp] Failed to send follow-up to ${recipient}:`, error);
            }
        }

        console.log(`[WhatsApp] Sent ${totalSent} messages successfully, ${totalFailed} failed`);

        if (totalFailed > 0) {
            const failureDetails = failedRecipients
                .map(f => {
                    const massifName = MassifCache.findByCode(f.massif)?.name || `massif ${f.massif}`;
                    return `• ${f.recipient} (${massifName})`;
                })
                .join('\n');

            await Analytics.send(
                `🚨 WhatsApp notification delivery failures\n\n${totalFailed}/${messages.length} notifications failed:\n${failureDetails}`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        if (recordingFailures.length > 0) {
            await Analytics.send(
                `⚠️ WhatsApp: Failed to record ${recordingFailures.length} delivery record(s)\n\nRecipients: ${recordingFailures.map(f => f.recipient).join(', ')}`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        return totalSent;
    }

    async function sendBulletinToRecipient(message: {
        recipient: string;
        bulletin: Bulletin;
        massif: number;
        subscription?: Subscription;
    }): Promise<void> {
        const massif = MassifCache.findByCode(message.massif);
        if (!massif) {
            throw new Error(`Massif ${message.massif} not found`);
        }

        const contentTypes = message.subscription || {bulletin: true};

        await WhatsAppDelivery.sendBulletinWithContent(
            message.recipient,
            message.bulletin,
            massif,
            contentTypes,
        );
    }
}
