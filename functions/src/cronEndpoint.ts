import {Request, Response} from '@google-cloud/functions-framework';
import cron from "@cron/index";

export async function cronEndpoint(req: Request, res: Response) {
    try {
        console.log('Cron job triggered');
        const result = await cron();
        res.status(result.status === 'failed' ? 500 : 200).json(result);
    } catch (error) {
        console.error('Error in cron job:', error);
        res.status(500).send('Cron job failed');
    }
}
