import {Bot, Context, InputFile} from "grammy";
import {Bulletin, ContentTypes, Massif} from "@app-types";
import {ImageService} from "@services/imageService";
import {InputMediaBuilder} from "grammy";

export namespace ContentDeliveryService {

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
            recipient?: string
        }
    ): Promise<void> {
        const {context, bot, recipient} = options;

        // Validate we have a way to send
        if (!context && (!bot || !recipient)) {
            throw new Error('Must provide either context or (bot + recipient)');
        }

        // Send bulletin PDF if enabled
        if (contentTypes.bulletin !== false) {  // Default to true if undefined
            if (context) {
                await context.replyWithDocument(bulletin.public_url);

                if (bulletin.valid_to < new Date()) {
                    await context.reply(`Latest bulletin for ${massif.name} is outdated`);
                }
            } else if (bot && recipient) {
                await bot.api.sendDocument(recipient, bulletin.public_url);
            }
        }

        // Fetch and send images for enabled content types
        const fetchedImages = await ImageService.fetchImages(massif.code, contentTypes, bulletin);

        // Send images if any were successfully fetched
        if (fetchedImages.length > 0) {
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
        contentTypes: Partial<ContentTypes>
    ): Promise<void> {
        return sendBulletinWithContent(bulletin, massif, contentTypes, {context});
    }

    /**
     * Convenience method for Bot API-based sending (cron notifications)
     */
    export async function sendWithBotApi(
        bot: Bot,
        recipient: string,
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>
    ): Promise<void> {
        return sendBulletinWithContent(bulletin, massif, contentTypes, {bot, recipient});
    }
}
