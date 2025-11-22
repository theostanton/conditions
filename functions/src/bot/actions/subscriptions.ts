import {Context} from "grammy";
import {MenuFlavor} from "@grammyjs/menu";
import {Subscriptions} from "@database/models/Subscriptions";
import {Massif, ContentTypes} from "@app-types";
import {ActionBulletins} from "@bot/actions/bulletins";
import {Analytics} from "@analytics/Analytics";
import {ImageService} from "@cron/services/imageService";
import {InputMediaBuilder} from "grammy";

// Store temporary content type selections for each user/massif combination
const contentTypeSelections = new Map<string, Partial<ContentTypes>>();

function getSelectionKey(userId: number, massifCode: number): string {
    return `${userId}:${massifCode}`;
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

            // Send bulletin asynchronously if bulletin is enabled
            if (contentTypes.bulletin) {
                ActionBulletins.send(context, massif, false).catch(err =>
                    console.error('Error sending bulletin:', err)
                );
            }

            // Send images for any enabled content types (excluding bulletin which is a PDF)
            const imageUrls = ImageService.buildImageUrls(massif.code, contentTypes);
            if (imageUrls.length > 0) {
                const mediaGroup = imageUrls.map(url => InputMediaBuilder.photo(url));
                context.replyWithMediaGroup(mediaGroup).catch(err =>
                    console.error('Error sending images:', err)
                );
            }

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
