import {Bot} from "grammy";
import {ADMIN_CHAT_ID, TELEGRAM_BOT_TOKEN} from "@config/envs";

class AnalyticsService {
    private ENABLED = true
    private bot: Bot;

    constructor() {
        this.bot = new Bot(TELEGRAM_BOT_TOKEN);
    }

    /**
     * Sends an analytics message to the admin chat
     * @param message The message to send
     * @param metadata Optional metadata to include with the message
     */
    async send(message: string, metadata?: Record<string, any>): Promise<void> {
        if (!this.ENABLED) {
            return
        }
        try {
            let fullMessage = `📊 ${message}`;

            if (metadata) {
                fullMessage += '\n\nMetadata:';
                for (const [key, value] of Object.entries(metadata)) {
                    fullMessage += `\n• ${key}: ${JSON.stringify(value)}`;
                }
            }

            await this.bot.api.sendMessage(ADMIN_CHAT_ID, fullMessage);
        } catch (error) {
            console.error('Failed to send analytics message:', error);
            // Don't throw - we don't want analytics failures to break the application
        }
    }

    /**
     * Sends an error notification to the admin chat
     * @param error The error object or message
     * @param context Additional context about where the error occurred
     */
    async sendError(error: Error | string, context?: string): Promise<void> {
        if (!this.ENABLED) {
            return
        }
        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack : undefined;

        let message = `🚨 Error Alert\n\n${errorMessage}`;

        if (context) {
            message += `\n\nContext: ${context}`;
        }

        if (errorStack) {
            message += `\n\nStack trace:\n${errorStack.substring(0, 500)}`;
        }

        await this.send(message);
    }
}

// Export a singleton instance
export const Analytics = new AnalyticsService();
