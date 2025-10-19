import {Request, Response} from '@google-cloud/functions-framework';
import {setupDatabase} from "@config/database";
import {createBot} from "@bot/index";
import {webhookCallback} from "grammy";

let bot: Awaited<ReturnType<typeof createBot>> | null = null;

async function initBot() {
    if (!bot) {
        console.log('Setting up database');
        await setupDatabase();

        console.log('Creating bot');
        bot = await createBot();
    }
    return bot;
}

// export default async function (req: Request, res: Response) {
//     try {
//         // Initialize bot on first request (cold start)
//         const botInstance = await initBot();
//
//         // Use Grammy's webhook callback
//         const handler = webhookCallback(botInstance, "gcf");
//
//         // Handle the request
//         await handler(req, res);
//     } catch (error) {
//         console.error('Error handling webhook:', error);
//         res.status(500).send('Internal Server Error');
//     }
// };
