import { checkForNewBulletins, fetchAndStoreBulletins } from "./services/bulletinService";
import { generateSubscriptionDestinations, send } from "./services/notificationService";
import {setupDatabase} from "@config/database";
import {Database} from "@database/queries";
import {CronExecutions, type CronExecution} from "@database/models/CronExecutions";

export default async function() {
    const startTime = Date.now();
    const execution: CronExecution = {
        status: 'success',
    };

    try {
        await setupDatabase();

        // Check Bulletin difference
        const newBulletinsToFetch = await checkForNewBulletins();
        execution.updated_bulletins_count = newBulletinsToFetch.length;
        console.log(`newBulletinsToFetch=${JSON.stringify(newBulletinsToFetch)}`);
        console.log();

        execution.massifs_with_subscribers_count = await Database.getMassifsWithSubscribers().then(m => m.length);

        // Fetch + Store new Bulletins
        const newBulletins = await fetchAndStoreBulletins(newBulletinsToFetch);
        console.log(`newBulletins=${JSON.stringify(newBulletins)}`);

        // Check subscription difference
        const destinations = await generateSubscriptionDestinations(newBulletins);
        console.log(`destinations=${JSON.stringify(destinations)}`);

        // Calculate subscriber count and bulletins delivered
        execution.subscriber_count = destinations.reduce((sum, dest) => sum + dest.recipients.length, 0);
        execution.bulletins_delivered_count = execution.subscriber_count; // Each subscriber gets one bulletin

        // Send to subscribers
        await send(destinations);

        // Generate summary
        if (execution.updated_bulletins_count === 0) {
            execution.summary = `No new bulletins found. Checked ${execution.massifs_with_subscribers_count} massifs with active subscriptions.`;
        } else if (execution.bulletins_delivered_count === 0) {
            execution.summary = `Found ${execution.updated_bulletins_count} new bulletins but no subscribers to notify.`;
            execution.status = 'partial';
        } else {
            execution.summary = `Successfully processed ${execution.updated_bulletins_count} new bulletins and delivered to ${execution.subscriber_count} subscribers across ${destinations.length} massifs.`;
        }

    } catch (error) {
        execution.status = 'failed';
        execution.error_message = error instanceof Error ? error.message : String(error);
        execution.summary = `Cron job failed: ${execution.error_message}`;
        console.error('Error in main cron logic:', error);
    } finally {
        // Always record execution, even on failure
        execution.duration_ms = Date.now() - startTime;
        try {
            await CronExecutions.insert(execution);
        } catch (dbError) {
            console.error('Failed to insert cron execution record:', dbError);
        }
    }

    return { status: execution.status, summary: execution.summary };
}