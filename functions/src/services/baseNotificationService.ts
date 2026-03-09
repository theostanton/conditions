import {Bulletin, BulletinDestination, Platform, Subscription} from "@app-types";
import {Database} from "@database/queries";
import {Deliveries} from "@database/models/Deliveries";
import {ArrayUtils} from "@utils/array";
import {AsyncUtils} from "@utils/async";
import {formatError} from "@utils/formatters";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";
import type {ConditionsReport} from "@services/reportService";

export type DeliveryMessage = {
    recipient: string;
    bulletin: Bulletin;
    massif: string;
    subscription?: Subscription;
    report?: ConditionsReport;
};

export type NotificationConfig = {
    platform: Platform;
    batchSize: number;
    batchDelayMs: number;
    logPrefix: string;
    sendFn: (message: DeliveryMessage) => Promise<void>;
    transformFilename?: (filename: string) => string;
};

export async function generateSubscriptionDestinations(
    bulletins: Bulletin[],
    platform: Platform = 'telegram',
): Promise<BulletinDestination[]> {
    const subscriptions = await Database.getSubscriptionsByMassif(platform);
    const destinations: BulletinDestination[] = [];

    for (const subscription of subscriptions) {
        const bulletin = bulletins.find(b => b.massif === subscription.massif);
        if (bulletin != undefined) {
            const subscribers = subscription.recipients.split(",");

            const undeliveredRecipients = await Deliveries.getUndeliveredRecipients(
                subscribers, bulletin, platform
            );

            if (undeliveredRecipients.length > 0) {
                const subscriptionsWithContentTypes = await Database.getSubscriptionsByRecipients(
                    undeliveredRecipients,
                    subscription.massif,
                    platform,
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

export async function sendNotifications(
    destinations: BulletinDestination[],
    config: NotificationConfig,
    reports?: Map<string, ConditionsReport>,
): Promise<number> {
    const messages = destinations.flatMap(destination => {
        const filename = config.transformFilename
            ? config.transformFilename(destination.filename)
            : destination.filename;

        const bulletin: Bulletin = {
            massif: destination.massif,
            filename,
            public_url: destination.public_url,
            valid_from: destination.valid_from,
            valid_to: destination.valid_to,
            risk_level: destination.risk_level,
        };

        return destination.recipients.map(recipient => {
            const subscription = destination.subscriptions.find(s => s.recipient === recipient);
            return {
                recipient,
                bulletin,
                massif: destination.massif,
                subscription,
                report: reports?.get(destination.massif),
            };
        });
    });

    const batches = ArrayUtils.chunk(messages, config.batchSize);
    let totalSent = 0;
    let totalFailed = 0;
    const failedRecipients: Array<{recipient: string; massif: string; error: any}> = [];
    const recordingFailures: Array<{recipient: string; error: any}> = [];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        console.log(`${config.logPrefix}Sending batch ${i + 1}/${batches.length} (${batch.length} messages)`);

        const results = await Promise.allSettled(
            batch.map(msg => config.sendFn(msg))
        );

        for (let idx = 0; idx < results.length; idx++) {
            const result = results[idx];
            const msg = batch[idx];

            if (result.status === 'fulfilled') {
                totalSent++;
                try {
                    await Deliveries.recordDelivery(msg.recipient, msg.bulletin, config.platform);
                } catch (error) {
                    console.error(`${config.logPrefix}Failed to record delivery for ${msg.recipient}: ${formatError(error)}`);
                    recordingFailures.push({recipient: msg.recipient, error});
                }
            } else {
                totalFailed++;
                console.error(`${config.logPrefix}Failed to send to ${msg.recipient}: ${formatError(result.reason)}`);
                failedRecipients.push({
                    recipient: msg.recipient,
                    massif: msg.massif,
                    error: result.reason,
                });
            }
        }

        if (i < batches.length - 1) {
            await AsyncUtils.delay(config.batchDelayMs);
        }
    }

    console.log(`${config.logPrefix}Sent ${totalSent} messages successfully, ${totalFailed} failed`);

    if (totalFailed > 0) {
        const platformLabel = config.platform === 'whatsapp' ? 'WhatsApp notification' : 'Notification';
        const failureDetails = failedRecipients
            .map(f => {
                const massifName = MassifCache.findByCode(f.massif)?.name || `massif ${f.massif}`;
                return `• ${f.recipient} (${massifName})`;
            })
            .join('\n');

        await Analytics.send(
            `🚨 ${platformLabel} delivery failures\n\n${totalFailed}/${messages.length} notifications failed:\n${failureDetails}`
        ).catch(err => console.error('Failed to send analytics:', err));
    }

    if (recordingFailures.length > 0) {
        const platformLabel = config.platform === 'whatsapp' ? 'WhatsApp: ' : '';
        await Analytics.send(
            `⚠️ ${platformLabel}Failed to record ${recordingFailures.length} delivery record(s)\n\nRecipients: ${recordingFailures.map(f => f.recipient).join(', ')}`
        ).catch(err => console.error('Failed to send analytics:', err));
    }

    return totalSent;
}
