import {Request, Response} from '@google-cloud/functions-framework';
import {setupDatabase} from "@config/database";
import {createBot} from "@bot/index";
import {webhookCallback} from "grammy";

// Initialize DB + bot eagerly at instance boot (not on first request)
const ready = (async () => {
    console.log('Setting up database');
    await setupDatabase();
    console.log('Creating bot');
    const bot = await createBot();
    return webhookCallback(bot, "express");
})();

export async function telegramWebhook(req: Request, res: Response) {
    try {
        const handler = await ready;
        await handler(req as any, res as any);
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).send('Internal Server Error');
    }
}
