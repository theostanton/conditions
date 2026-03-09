import {Bulletin, BulletinDestination} from "@app-types";
import {formatError} from "@utils/formatters";
import {WhatsAppDelivery, sendReportTemplate} from "@whatsapp/flows/delivery";
import {MassifCache} from "@cache/MassifCache";
import {CONDITIONS_REPORT_ENABLED} from "@constants/contentTypes";
import {generateSubscriptionDestinations, sendNotifications} from "@services/baseNotificationService";
import type {DeliveryMessage} from "@services/baseNotificationService";
import type {ConditionsReport} from "@services/reportService";

export namespace WhatsappNotificationService {

    export async function generateDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
        return generateSubscriptionDestinations(bulletins, 'whatsapp');
    }

    export async function send(destinations: BulletinDestination[], reports?: Map<string, ConditionsReport>): Promise<number> {
        return sendNotifications(destinations, {
            platform: 'whatsapp',
            batchSize: 10,
            batchDelayMs: 1_000,
            logPrefix: '[WhatsApp] ',
            sendFn: sendBulletinToRecipient,
            transformFilename: (filename) => filename.replace(/^\/tmp\//, ''),
        }, reports);
    }

    async function sendBulletinToRecipient(message: DeliveryMessage): Promise<void> {
        const massif = MassifCache.findByCode(message.massif);
        if (!massif) {
            throw new Error(`Massif ${message.massif} not found`);
        }

        const contentTypes = message.subscription || {bulletin: true};

        if (CONDITIONS_REPORT_ENABLED && message.report && message.subscription?.conditions_report) {
            try {
                await sendReportTemplate(
                    message.recipient,
                    message.bulletin,
                    massif,
                    message.report.whatsapp,
                );
                const imagesOnly = {...contentTypes, bulletin: false};
                await WhatsAppDelivery.sendBulletinWithContent(
                    message.recipient,
                    message.bulletin,
                    massif,
                    imagesOnly,
                );
                return;
            } catch (error) {
                console.error(`[WhatsApp] Failed to send report template to ${message.recipient}: ${formatError(error)}`);
            }
        }

        await WhatsAppDelivery.sendBulletinWithContent(
            message.recipient,
            message.bulletin,
            massif,
            contentTypes,
        );
    }
}
