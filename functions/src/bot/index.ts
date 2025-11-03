import {Bot} from "grammy";
import {CommandGet} from './commands/get';
import {CommandSubscriptions} from './commands/subscriptions';
import {MassifCache} from '@cache/MassifCache';
import {TELEGRAM_BOT_TOKEN} from "@config/envs";

export async function createBot(): Promise<Bot> {
    const bot = new Bot(TELEGRAM_BOT_TOKEN);

    console.log('Database setup complete');

    // Initialize massif cache
    await MassifCache.initialize();

    // Note: bot.api.setMyCommands() has been removed from the hot path.
    // Commands only need to be set once. Run this manually when deploying:
    // const bot = new Bot(token); await bot.api.setMyCommands([...]);

    await CommandGet.attach(bot)
    await CommandSubscriptions.attach(bot)

    bot.on('message:text', async (ctx) => {
        const text = ctx.message.text;

        // Skip if it's a command (starts with /)
        if (text.startsWith('/')) {
            return;
        }

        await ctx.reply(
            "👇Hit the Menu button to get started"
        );
    });

    return bot;
}

