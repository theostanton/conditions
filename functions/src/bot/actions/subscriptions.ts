import {Context} from "grammy";
import {MenuFlavor} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif, ContentTypes} from "@app-types";
import {Analytics} from "@analytics/Analytics";
import {Bulletins} from "@database/models/Bulletins";
import {BulletinService} from "@services/bulletinService";
import {ContentDeliveryService} from "@services/contentDeliveryService";

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
    if (bulletin) {
        await ContentDeliveryService.sendWithContext(context, bulletin, massif, contentTypes);
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
                await context.reply("Unable to identify user");
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
                    text: `Failed to update subscription for ${massif.name}`,
                    show_alert: true
                }).catch(() => {});
            }

            await context.reply(`Failed to update subscription for ${massif.name}. Please try again.`);
        }
    }

    export async function unsubscribe(context: Context & MenuFlavor, massif: Massif): Promise<void> {
        try {
            if (!context.from?.id) {
                await context.reply("Unable to identify user");
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
                    text: `Failed to unsubscribe from ${massif.name}`,
                    show_alert: true
                }).catch(() => {});
            }

            await context.reply(`Failed to unsubscribe from ${massif.name}. Please try again.`);
        }
    }
}
