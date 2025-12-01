import {Context} from "grammy";
import {MenuFlavor} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif, ContentTypes} from "@app-types";
import {Analytics} from "@analytics/Analytics";
import {Bulletins} from "@database/models/Bulletins";
import {BulletinService} from "@services/bulletinService";
import {ContentDeliveryService} from "@services/contentDeliveryService";
import {BotMessages} from "@bot/messages";
import {Deliveries} from "@database/models/Deliveries";

// Store temporary content type selections for each user/massif combination
const contentTypeSelections = new Map<string, Partial<ContentTypes>>();

function getSelectionKey(userId: number, massifCode: number): string {
    return `${userId}:${massifCode}`;
}

async function sendWelcomeContent(context: Context, massif: Massif, contentTypes: Partial<ContentTypes>): Promise<void> {
    // Get latest bulletin
    let bulletin = await Bulletins.getLatest(massif.code);

    // If no bulletin or outdated, fetch new one
    if (!bulletin || bulletin.valid_to < new Date()) {
        const metadata = await BulletinService.fetchBulletinMetadata(massif.code);
        if (metadata) {
            const bulletins = await BulletinService.fetchAndStoreBulletins([{
                massif: massif.code,
                valid_from: metadata.validFrom,
                valid_to: metadata.validTo,
                risk_level: metadata.riskLevel
            }]);
            if (bulletins.length > 0) {
                bulletin = bulletins[0];
            }
        }
    }

    // Send bulletin and images if we have one
    if (bulletin && context.from?.id) {
        // Welcome content for new subscriptions should show the Manage Subscription button
        await ContentDeliveryService.sendWithContext(context, bulletin, massif, contentTypes, 'subscription');

        // Record delivery to prevent duplicate sending on next cron run
        try {
            await Deliveries.recordDelivery(context.from.id.toString(), bulletin);
        } catch (error) {
            console.error(`Failed to record welcome delivery for ${context.from.id}:`, error);
            // Don't throw - delivery was successful, just recording failed
        }
    }
}

export namespace ActionSubscriptions {

    export function initializeContentTypes(userId: number, massif: Massif, existing?: Partial<ContentTypes>): void {
        const key = getSelectionKey(userId, massif.code);
        contentTypeSelections.set(key, existing || { bulletin: true });
    }

    export function getContentTypes(userId: number, massif: Massif): Partial<ContentTypes> {
        const key = getSelectionKey(userId, massif.code);
        return contentTypeSelections.get(key) || { bulletin: true };
    }

    export function toggleContentType(userId: number, massif: Massif, type: keyof ContentTypes): void {
        const key = getSelectionKey(userId, massif.code);
        const current = contentTypeSelections.get(key) || { bulletin: true };
        current[type] = !current[type];
        contentTypeSelections.set(key, current);
    }

    export function clearContentTypes(userId: number, massif: Massif): void {
        const key = getSelectionKey(userId, massif.code);
        contentTypeSelections.delete(key);
    }

    export async function saveContentTypes(context: Context & MenuFlavor, massif: Massif): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }

            const recipientId = context.from.id;
            const key = getSelectionKey(recipientId, massif.code);
            const contentTypes = contentTypeSelections.get(key) || { bulletin: true };

            // Subscribe or update with the selected content types
            await Subscriptions.subscribe(recipientId, massif, contentTypes);

            // Clear the temporary selection
            clearContentTypes(recipientId, massif);

            // Navigate back to massif list
            if (context.callbackQuery?.message) {
                // Get the mountain name from the massif to restore the title
                const mountains = await import('@cache/MassifCache').then(m => m.MassifCache.getMountains());
                let mountain = '';
                for (const m of mountains) {
                    const massifs = await import('@cache/MassifCache').then(mc => mc.MassifCache.getByMountain(m));
                    if (massifs.some(ms => ms.code === massif.code)) {
                        mountain = m;
                        break;
                    }
                }

                await context.editMessageText(BotMessages.menuHeaders.yourSubscriptions(mountain), {parse_mode: BotMessages.parseMode}).catch(err =>
                    console.error('Error updating message text:', err)
                );
                await context.menu.back({immediate: true}).catch(err =>
                    console.error('Error navigating back:', err)
                );
            }

            // Send bulletin and images based on selected content types (asynchronously)
            sendWelcomeContent(context, massif, contentTypes).catch(err =>
                console.error('Error sending welcome content:', err)
            );

            // Analytics - non-blocking
            Analytics.send(`${context.from?.id} subscribed to ${massif.name} with content types: ${JSON.stringify(contentTypes)}`).catch(err =>
                console.error('Analytics error:', err)
            );

        } catch (error) {
            console.error('Error saving content types:', error);

            if (context.callbackQuery) {
                await context.answerCallbackQuery({
                    text: BotMessages.errors.updateSubscriptionFailed(massif.name),
                    show_alert: true
                }).catch(() => {});
            }

            await context.reply(BotMessages.errors.updateSubscriptionRetry(massif.name));
        }
    }

    export async function unsubscribe(context: Context & MenuFlavor, massif: Massif): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply(BotMessages.errors.unableToIdentifyUser);
                return;
            }

            const recipientId = context.from.id;

            // Unsubscribe
            await Subscriptions.unsubscribe(recipientId, massif);

            // Clear any temporary selections
            clearContentTypes(recipientId, massif);

            // Update menu immediately to reflect the change
            if (context.callbackQuery?.message) {
                await context.menu.update({immediate: true}).catch(err =>
                    console.error('Error updating menu:', err)
                );
            }

            // Analytics - non-blocking
            Analytics.send(`${context.from?.id} unsubscribed from ${massif.name}`).catch(err =>
                console.error('Analytics error:', err)
            );

        } catch (error) {
            console.error('Error unsubscribing:', error);

            if (context.callbackQuery) {
                await context.answerCallbackQuery({
                    text: BotMessages.errors.unsubscribeFailed(massif.name),
                    show_alert: true
                }).catch(() => {});
            }

            await context.reply(BotMessages.errors.unsubscribeRetry(massif.name));
        }
    }
}
