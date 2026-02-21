import {Request, Response} from '@google-cloud/functions-framework';
import {setupDatabase} from "@config/database";
import {createBot} from "@bot/index";
import {webhookCallback} from "grammy";

let bot: Awaited<ReturnType<typeof createBot>> | null = null;
let handler: ((req: any, res: any) => Promise<void>) | null = null;

async function initBot() {
    if (!bot) {
        console.log('Setting up database');
        await setupDatabase();

        console.log('Creating bot');
        bot = await createBot();

        // Cache the webhook handler to avoid recreating on every request
        handler = webhookCallback(bot, "express");
    }
    return bot;
}

export async function telegramWebhook(req: Request, res: Response) {
    try {
        // Initialize bot on first request (cold start)
        await initBot();

        // Use cached webhook handler
        await handler!(req as any, res as any);
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).send('Internal Server Error');
    }
};
