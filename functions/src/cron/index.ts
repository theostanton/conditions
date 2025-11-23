import {BulletinService} from "@services/bulletinService";
import {NotificationService} from "./services/notificationService";
import {setupDatabase, closeConnection} from "@config/database";
import {Database} from "@database/queries";
import {CronExecutions, type CronExecution} from "@database/models/CronExecutions";
import {Analytics} from "@analytics/Analytics";
import {MassifCache} from "@cache/MassifCache";

export default async function () {
    const startTime = Date.now();
    const execution: CronExecution = {
        status: 'success',
    };
    let stage: string = 'setupDatabase'

    try {
        await setupDatabase();

        // Initialize massif cache for notification sending
        stage = 'initializeMassifCache'
        await MassifCache.initialize();

        // Massifs with subscribers - fetch both in parallel
        stage = 'getSubscriberStats'
        const [totalSubscribers, massifsWithSubscribers] = await Promise.all([
            Database.getTotalSubscribers(),
            Database.getMassifsWithSubscribers()
        ]);
        execution.subscriber_count = totalSubscribers;
        execution.massifs_with_subscribers_count = massifsWithSubscribers.length;

        // Check Bulletin difference
        stage = 'checkForNewBulletins'
        const newBulletinsResult = await BulletinService.checkForNewBulletins();
        const newBulletinsToFetch = newBulletinsResult.bulletinInfosToUpdate
        execution.updated_bulletins_count = newBulletinsToFetch.length;
        if (newBulletinsResult.failedMassifs.length > 0) {
            execution.status = 'partial'
        }
        const newBulletinsSummary = `Bulletins(failed:${newBulletinsResult.failedMassifs.length}, updated:${newBulletinsResult.massifsWithUpdate.length}, noUpdates:${newBulletinsResult.massifsWithNoUpdate.length})`
        console.log(`newBulletinsToFetch=${JSON.stringify(newBulletinsToFetch)}`);
        console.log(`failedMassifs=${JSON.stringify(newBulletinsResult.failedMassifs)}`);
        console.log();


        if (execution.updated_bulletins_count > 0) {
            // Fetch + Store new Bulletins
            stage = 'fetchAndStoreBulletins'
            const newBulletins = await BulletinService.fetchAndStoreBulletins(newBulletinsToFetch);
            console.log(`newBulletins=${JSON.stringify(newBulletins)}`);
        }

        // Always check all valid bulletins for delivery, not just new ones
        // This ensures failed deliveries are retried on subsequent runs
        stage = 'getValidBulletins'
        const validBulletins = await Database.getValidBulletins();
        console.log(`validBulletins count=${validBulletins.length}`);

        if (validBulletins.length > 0) {
            // Check subscription difference
            stage = 'generateSubscriptionDestinations'
            const destinations = await NotificationService.generateSubscriptionDestinations(validBulletins);
            console.log(`destinations=${JSON.stringify(destinations)}`);

            // Send to subscribers
            stage = 'send'
            execution.bulletins_delivered_count = await NotificationService.send(destinations);

            execution.summary = `Deliveries made. ${newBulletinsSummary}`;
        } else {
            execution.bulletins_delivered_count = 0
            execution.summary = `No deliveries necessary. ${newBulletinsSummary}`;
        }

    } catch (error) {
        execution.status = 'failed';
        execution.error_message = error instanceof Error ? error.message : String(error);
        execution.summary = `Failed at ${stage}: ${execution.error_message}`;
        console.error(`Error in main cron logic on ${stage}:`, error);

        // Send real-time alert to admin about cron failure
        await Analytics.sendError(
            error as Error,
            `Cron job failed at stage: ${stage}`
        ).catch(err => console.error('Failed to send error analytics:', err));
    } finally {
        // Always record execution, even on failure
        execution.duration_ms = Date.now() - startTime;
        try {
            await CronExecutions.insert(execution);
        } catch (dbError) {
            console.error('Failed to insert cron execution record:', dbError);
            await Analytics.sendError(
                dbError as Error,
                'Failed to insert cron execution record'
            ).catch(err => console.error('Failed to send error analytics:', err));
        }

        // Send summary notification to admin based on execution status
        if (execution.status === 'success' && (execution.bulletins_delivered_count ?? 0) > 0) {
            const durationSec = ((execution.duration_ms ?? 0) / 1000).toFixed(1);
            await Analytics.send(
                `✅ Cron job completed successfully\n\n${execution.summary}\n\nDelivered: ${execution.bulletins_delivered_count} bulletins\nDuration: ${durationSec}s`
            ).catch(err => console.error('Failed to send analytics:', err));
        } else if (execution.status === 'partial') {
            const durationSec = ((execution.duration_ms ?? 0) / 1000).toFixed(1);
            await Analytics.send(
                `⚠️ Cron job completed with partial failures\n\n${execution.summary}\n\nDuration: ${durationSec}s`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        // Close the database connection to prevent connection leaks
        await closeConnection();
    }

    return {status: execution.status, summary: execution.summary};
}