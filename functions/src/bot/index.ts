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

    await bot.api.setMyCommands([
        {command: "get", description: "Get the latest BERA"},
        {command: "subscriptions", description: "Manage your BRA subscriptions"},
    ]);

    await CommandGet.attach(bot)
    await CommandSubscriptions.attach(bot)

    return bot;
}

