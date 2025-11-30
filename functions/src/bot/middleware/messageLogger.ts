import {Bot, Context} from "grammy";
import {MessageLogs} from "@database/models/MessageLogs";

/**
 * Middleware to log all messages sent by the bot (outgoing)
 */
function setupOutgoingMessageLogging(bot: Bot) {
    // Use API middleware to intercept outgoing API calls
    bot.api.config.use(async (prev, method, payload, signal) => {
        // Call the original method first
        const result = await prev(method, payload, signal);

        // Log message after successful send
        try {
            // Type assertion for payload to access properties
            const typedPayload = payload as any;
            const recipient = typedPayload.chat_id ? String(typedPayload.chat_id) : null;

            if (!recipient) {
                return result;
            }

            let messageContent: string | null = null;

            // Handle different message types
            if (method === 'sendMessage' && typedPayload.text) {
                messageContent = `[bot→user] ${typedPayload.text}`;
            } else if (method === 'sendDocument') {
                const docUrl = typeof typedPayload.document === 'string' ? typedPayload.document : '[uploaded file]';
                messageContent = `[bot→user] [document] ${docUrl}`;
            } else if (method === 'sendMediaGroup' && typedPayload.media) {
                const mediaCount = Array.isArray(typedPayload.media) ? typedPayload.media.length : 1;
                messageContent = `[bot→user] [media group] ${mediaCount} items`;
            } else if (method === 'sendPhoto') {
                messageContent = `[bot→user] [photo]`;
            }

            // Log if we extracted content
            if (messageContent) {
                await MessageLogs.insert(recipient, messageContent);
                console.log(`Logged outgoing ${method} to ${recipient}`);
            }
        } catch (error) {
            console.error('Failed to log outgoing message:', error);
            // Don't throw - we don't want to break the bot if logging fails
        }

        return result;
    });
}

/**
 * Middleware to log all messages received by the bot (incoming)
 */
function setupIncomingMessageLogging(bot: Bot) {
    bot.use(async (ctx: Context, next) => {
        try {
            const sender = ctx.from?.id ? String(ctx.from.id) : null;

            if (sender && ctx.message) {
                let messageContent: string | null = null;

                // Handle different incoming message types
                if (ctx.message.text) {
                    messageContent = `[user→bot] ${ctx.message.text}`;
                } else if (ctx.message.photo) {
                    messageContent = `[user→bot] [photo]`;
                } else if (ctx.message.document) {
                    const fileName = ctx.message.document.file_name || '[unnamed file]';
                    messageContent = `[user→bot] [document] ${fileName}`;
                } else if (ctx.message.voice) {
                    messageContent = `[user→bot] [voice message]`;
                } else if (ctx.message.video) {
                    messageContent = `[user→bot] [video]`;
                } else if (ctx.message.sticker) {
                    messageContent = `[user→bot] [sticker]`;
                } else if (ctx.message.location) {
                    messageContent = `[user→bot] [location]`;
                }

                if (messageContent) {
                    await MessageLogs.insert(sender, messageContent);
                    console.log(`Logged incoming message from ${sender}`);
                }
            }
        } catch (error) {
            console.error('Failed to log incoming message:', error);
            // Don't throw - we don't want to break the bot if logging fails
        }

        await next();
    });
}

/**
 * Setup both incoming and outgoing message logging
 */
export function setupMessageLogging(bot: Bot) {
    setupIncomingMessageLogging(bot);
    setupOutgoingMessageLogging(bot);
}
