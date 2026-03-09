import {bot} from "@config/telegram";
import {Bulletin, BulletinDestination} from "@app-types";
import {formatError} from "@utils/formatters";
import {ContentDeliveryService} from "@services/contentDeliveryService";
import {MassifCache} from "@cache/MassifCache";
import {CONDITIONS_REPORT_ENABLED} from "@constants/contentTypes";
import {generateSubscriptionDestinations, sendNotifications} from "@services/baseNotificationService";
import type {DeliveryMessage} from "@services/baseNotificationService";
import type {ConditionsReport} from "@services/reportService";

export namespace NotificationService {

    export async function generateDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
        return generateSubscriptionDestinations(bulletins, 'telegram');
    }

    export async function send(destinations: BulletinDestination[], reports?: Map<string, ConditionsReport>): Promise<number> {
        return sendNotifications(destinations, {
            platform: 'telegram',
            batchSize: 20,
            batchDelayMs: 1_000,
            logPrefix: '',
            sendFn: sendBulletinWithContent,
        }, reports);
    }

    async function sendBulletinWithContent(message: DeliveryMessage): Promise<void> {
        const massif = MassifCache.findByCode(message.massif);
        if (!massif) {
            throw new Error(`Massif ${message.massif} not found`);
        }

        const contentTypes = message.subscription || {bulletin: true};

        if (CONDITIONS_REPORT_ENABLED && message.report && message.subscription?.conditions_report) {
            try {
                await bot.api.sendMessage(message.recipient, message.report.fullReport);
            } catch (error) {
                console.error(`Failed to send report to ${message.recipient}: ${formatError(error)}`);
            }
        }

        await ContentDeliveryService.sendWithBotApi(bot, message.recipient, message.bulletin, massif, contentTypes, 'subscription');
    }
}
