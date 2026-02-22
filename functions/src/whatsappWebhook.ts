import {Request, Response} from '@google-cloud/functions-framework';
import {setupDatabase} from "@config/database";
import {MassifCache} from "@cache/MassifCache";
import {WA_VERIFY_TOKEN} from "@config/whatsapp";
import {WhatsAppRouter} from "@whatsapp/router";
import type {WAWebhookPayload} from "@whatsapp/types";

// Initialize DB + cache eagerly at instance boot (not on first request)
const ready = (async () => {
    console.log('Setting up database');
    await setupDatabase();
    console.log('Initializing massif cache');
    await MassifCache.initialize();
})();

export async function whatsappWebhook(req: Request, res: Response) {
    // GET = webhook verification from Meta
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            console.warn('Webhook verification failed');
            res.status(403).send('Forbidden');
        }
        return;
    }

    // POST = incoming message
    // Always return 200 immediately to prevent Meta retries
    res.status(200).send('OK');

    try {
        await ready;

        const payload = req.body as WAWebhookPayload;
        await WhatsAppRouter.handleWebhook(payload);
    } catch (error) {
        console.error('Error handling WhatsApp webhook:', error);
    }
}
