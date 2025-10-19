import {Bot} from "grammy";
import {setupDatabase} from '../database/connection';
import {CommandGet} from '../commands/get';
import {CommandSubscribe} from '../commands/subscribe';
import {CommandUnsubscribe} from '../commands/unsubscribe';

export async function createBot(): Promise<Bot> {
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN as string);

    console.log('Setting up database');
    await setupDatabase();
    console.log('Database setup complete');

    await bot.api.setMyCommands([
        {command: "get", description: "Get the latest BRA"},
        {command: "subscribe", description: "Subscribe to a BRA"},
        {command: "unsubscribe", description: "Unsubscribe from a BRA"},
    ]);


    await CommandGet.attach(bot)
    await CommandSubscribe.attach(bot)
    await CommandUnsubscribe.attach(bot)

    return bot;
}
