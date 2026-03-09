import {Bulletin, BulletinDestination, Subscription} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";
import {ArrayUtils} from "@utils/array";
import {AsyncUtils} from "@utils/async";
import {WhatsAppDelivery, sendReportTemplate} from "@whatsapp/flows/delivery";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";
import type {ConditionsReport} from "@services/reportService";

export namespace WhatsappNotificationService {

    export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
        const subscriptions = await Database.getSubscriptionsByMassif('whatsapp');
        const destinations: BulletinDestination[] = [];

        for (const subscription of subscriptions) {
            const bulletin = bulletins.find(b => b.massif === subscription.massif);
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

    export async function send(destinations: BulletinDestination[], reports?: Map<string, ConditionsReport>): Promise<number> {
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
                return {
                    recipient, bulletin, massif: destination.massif, subscription,
                    report: reports?.get(destination.massif),
                };
            });
        });

        // More conservative rate limiting than Telegram (WhatsApp Cloud API)
        const BATCH_SIZE = 10;
        const BATCH_DELAY_MS = 1_000;

        const batches = ArrayUtils.chunk(messages, BATCH_SIZE);
        let totalSent = 0;
        let totalFailed = 0;
        const failedRecipients: Array<{recipient: string; massif: string; error: any}> = [];
        const recordingFailures: Array<{recipient: string; error: any}> = [];

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
        massif: string;
        subscription?: Subscription;
        report?: ConditionsReport;
    }): Promise<void> {
        const massif = MassifCache.findByCode(message.massif);
        if (!massif) {
            throw new Error(`Massif ${message.massif} not found`);
        }

        const contentTypes = message.subscription || {bulletin: true};

        // conditions_report disabled — not ready for production
        // if (message.report && (message.subscription as any)?.conditions_report) {
        //     try {
        //         await sendReportTemplate(message.recipient, message.bulletin, massif, message.report.whatsapp);
        //         const imagesOnly = {...contentTypes, bulletin: false};
        //         await WhatsAppDelivery.sendBulletinWithContent(message.recipient, message.bulletin, massif, imagesOnly);
        //         return;
        //     } catch (error) {
        //         console.error(`[WhatsApp] Failed to send report template to ${message.recipient}:`, error);
        //     }
        // }

        await WhatsAppDelivery.sendBulletinWithContent(
            message.recipient,
            message.bulletin,
            massif,
            contentTypes,
        );
    }
}
