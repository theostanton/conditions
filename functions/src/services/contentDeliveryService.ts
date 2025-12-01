import {Bot, Context, InputFile, InlineKeyboard} from "grammy";
import {Bulletin, ContentTypes, Massif} from "@app-types";
import {ImageService} from "@services/imageService";
import {InputMediaBuilder} from "grammy";
import {Analytics} from "@analytics/Analytics";

export namespace ContentDeliveryService {

    export type DeliveryType = 'download' | 'subscription';

    /**
     * Send bulletin PDF and images based on content types
     * Works with both Context (for bot commands) and Bot API (for cron)
     */
    async function sendBulletinWithContent(
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>,
        options: {
            context?: Context,
            bot?: Bot,
            recipient?: string,
            deliveryType?: DeliveryType
        }
    ): Promise<void> {
        const {context, bot, recipient, deliveryType} = options;

        // Validate we have a way to send
        if (!context && (!bot || !recipient)) {
            throw new Error('Must provide either context or (bot + recipient)');
        }

        // Create inline keyboard based on delivery type
        let keyboard: InlineKeyboard | undefined;
        if (deliveryType === 'download') {
            keyboard = new InlineKeyboard()
                .text(`Subscribe to ${massif.name}`, `subscribe:${massif.code}`);
        } else if (deliveryType === 'subscription') {
            keyboard = new InlineKeyboard()
                .text(`Manage Subscription to ${massif.name}`, `manage_subscription:${massif.code}`);
        }

        // Send bulletin PDF if enabled
        if (contentTypes.bulletin !== false) {  // Default to true if undefined
            try {
                const replyMarkup = keyboard ? {reply_markup: keyboard} : undefined;

                if (context) {
                    await context.replyWithDocument(bulletin.public_url, replyMarkup);

                    if (bulletin.valid_to < new Date()) {
                        await context.reply(`Latest bulletin for ${massif.name} is outdated`);
                    }
                } else if (bot && recipient) {
                    await bot.api.sendDocument(recipient, bulletin.public_url, replyMarkup);
                }
            } catch (error) {
                console.error(`Failed to send bulletin PDF for ${massif.name}:`, error);
                await Analytics.sendError(
                    error as Error,
                    `contentDeliveryService: Failed to send bulletin PDF for ${massif.name}`
                ).catch(err => console.error('Failed to send error analytics:', err));
                throw error;
            }
        }

        // Fetch and send images for enabled content types
        let fetchedImages: ImageService.FetchedImage[] = [];
        try {
            fetchedImages = await ImageService.fetchImages(massif.code, contentTypes, bulletin);
        } catch (error) {
            console.error(`Failed to fetch images for ${massif.name}:`, error);
            await Analytics.sendError(
                error as Error,
                `contentDeliveryService: Failed to fetch images for ${massif.name}`
            ).catch(err => console.error('Failed to send error analytics:', err));
            // Don't throw - allow partial delivery (bulletin was sent successfully)
        }

        // Send images if any were successfully fetched
        if (fetchedImages.length > 0) {
            try {
                // Create InputFile objects from fetched image buffers with captions
                const mediaGroup = fetchedImages.map(image => {
                    const inputFile = new InputFile(image.data, image.filename);
                    return InputMediaBuilder.photo(inputFile, {caption: image.caption});
                });

                if (context) {
                    await context.replyWithMediaGroup(mediaGroup);
                } else if (bot && recipient) {
                    await bot.api.sendMediaGroup(recipient, mediaGroup);
                }
            } catch (error) {
                console.error(`Failed to send media group for ${massif.name}:`, error);
                await Analytics.sendError(
                    error as Error,
                    `contentDeliveryService: Failed to send media group for ${massif.name}`
                ).catch(err => console.error('Failed to send error analytics:', err));
                throw error;
            }
        } else {
            // If no bulletin and no images were sent, notify the user
            const bulletinSent = contentTypes.bulletin !== false;
            if (!bulletinSent) {
                const message = `No content available for ${massif.name}. The requested data might not be available from Météo France at this time.`;
                if (context) {
                    await context.reply(message);
                } else if (bot && recipient) {
                    await bot.api.sendMessage(recipient, message);
                }
            }
        }
    }

    /**
     * Convenience method for Context-based sending (bot commands)
     */
    export async function sendWithContext(
        context: Context,
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>,
        deliveryType?: DeliveryType
    ): Promise<void> {
        return sendBulletinWithContent(bulletin, massif, contentTypes, {context, deliveryType});
    }

    /**
     * Convenience method for Bot API-based sending (cron notifications)
     */
    export async function sendWithBotApi(
        bot: Bot,
        recipient: string,
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>,
        deliveryType?: DeliveryType
    ): Promise<void> {
        return sendBulletinWithContent(bulletin, massif, contentTypes, {bot, recipient, deliveryType});
    }
}
