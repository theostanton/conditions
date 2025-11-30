import {Bot, Keyboard} from "grammy";
import {CommandGet} from './commands/get';
import {CommandSubscriptions} from './commands/subscriptions';
import {MassifCache} from '@cache/MassifCache';
import {TELEGRAM_BOT_TOKEN} from "@config/envs";
import {BotMessages} from "@bot/messages";
import {setupMessageLogging} from "@bot/middleware/messageLogger";

export async function createBot(): Promise<Bot> {
    const bot = new Bot(TELEGRAM_BOT_TOKEN);

    console.log('Database setup complete');

    // Setup message logging middleware
    setupMessageLogging(bot);

    // Initialize massif cache
    await MassifCache.initialize();

    // Note: bot.api.setMyCommands() has been removed from the hot path.
    // Commands only need to be set once. Run this manually when deploying:
    // const bot = new Bot(token); await bot.api.setMyCommands([...]);

    // Attach both commands
    const getMenu = await CommandGet.attach(bot);
    const subscriptionsMenu = await CommandSubscriptions.attach(bot);

    // Handle "Download" button press - show the get/download menu
    bot.hears('Download', async (ctx) => {
        if (!ctx.from?.id) {
            await ctx.reply(BotMessages.errors.unableToIdentifyUser);
            return;
        }
        await ctx.reply(BotMessages.menuHeaders.selectRange, {
            reply_markup: getMenu,
            parse_mode: BotMessages.parseMode
        });
    });

    // Handle "Subscribe" button press - show subscriptions menu
    bot.hears('Subscribe', async (ctx) => {
        if (!ctx.from?.id) {
            await ctx.reply(BotMessages.errors.unableToIdentifyUser);
            return;
        }
        await ctx.reply(BotMessages.menuHeaders.selectRange, {
            reply_markup: subscriptionsMenu,
            parse_mode: BotMessages.parseMode
        });
    });

    bot.on('message:text', async (ctx) => {
        const text = ctx.message.text;

        // Skip if it's a command (starts with /)
        if (text.startsWith('/')) {
            return;
        }

        // Skip if it's a button press we've already handled
        if (text === 'Download' || text === 'Subscribe') {
            return;
        }

        // Create persistent keyboard with quick access buttons
        const keyboard = new Keyboard()
            .text("Download")
            .text("Subscribe")
            .resized();

        await ctx.reply(
            BotMessages.prompts.mainMenu,
            { reply_markup: keyboard }
        );
    });

    return bot;
}

