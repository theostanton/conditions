import { Request, Response } from '@google-cloud/functions-framework';
import { setupDatabase } from "@config/database";
import { checkForNewBulletins, fetchAndStoreBulletins } from "@cron/services/bulletinService";
import { generateSubscriptionDestinations, send } from "@cron/services/notificationService";
import { Database } from "@database/queries";

async function main() {
    const startTime = Date.now();
    let status: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;
    let massifsWithSubscribersCount = -1;
    let updatedBulletinsCount = -1;
    let subscriberCount = -1;
    let bulletinsDeliveredCount = -1;
    let summary = '';

    try {
        await setupDatabase();

        // Check Bulletin difference
        const newBulletinsToFetch = await checkForNewBulletins();
        console.log(`newBulletinsToFetch=${JSON.stringify(newBulletinsToFetch)}`);
        console.log();

        massifsWithSubscribersCount = await Database.getMassifsWithSubscribers().then(m => m.length);
        updatedBulletinsCount = newBulletinsToFetch.length;

        // Fetch + Store new Bulletins
        const newBulletins = await fetchAndStoreBulletins(newBulletinsToFetch);
        console.log(`newBulletins=${JSON.stringify(newBulletins)}`);

        // Check subscription difference
        const destinations = await generateSubscriptionDestinations(newBulletins);
        console.log(`destinations=${JSON.stringify(destinations)}`);

        // Calculate subscriber count and bulletins delivered
        subscriberCount = destinations.reduce((sum, dest) => sum + dest.recipients.length, 0);
        bulletinsDeliveredCount = subscriberCount; // Each subscriber gets one bulletin

        // Send to subscribers
        await send(destinations);

        // Generate summary
        if (updatedBulletinsCount === 0) {
            summary = `No new bulletins found. Checked ${massifsWithSubscribersCount} massifs with active subscriptions.`;
        } else if (bulletinsDeliveredCount === 0) {
            summary = `Found ${updatedBulletinsCount} new bulletins but no subscribers to notify.`;
            status = 'partial';
        } else {
            summary = `Successfully processed ${updatedBulletinsCount} new bulletins and delivered to ${subscriberCount} subscribers across ${destinations.length} massifs.`;
        }

    } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : String(error);
        summary = `Cron job failed: ${errorMessage}`;
        console.error('Error in main cron logic:', error);
    } finally {
        // Always record execution, even on failure
        const durationMs = Date.now() - startTime;
        try {
            await Database.insertCronExecution(
                status,
                subscriberCount,
                massifsWithSubscribersCount,
                updatedBulletinsCount,
                bulletinsDeliveredCount,
                summary,
                errorMessage,
                durationMs
            );
        } catch (dbError) {
            console.error('Failed to insert cron execution record:', dbError);
        }
    }

    return { status, summary };
}

export async function cronJob(req: Request, res: Response) {
    try {
        console.log('Cron job triggered');
        const result = await main();
        res.status(result.status === 'failed' ? 500 : 200).json(result);
    } catch (error) {
        console.error('Error in cron job:', error);
        res.status(500).send('Cron job failed');
    }             CXX~§§
}
