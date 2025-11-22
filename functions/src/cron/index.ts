import {BulletinService} from "@services/bulletinService";
import {NotificationService} from "./services/notificationService";
import {setupDatabase, closeConnection} from "@config/database";
import {Database} from "@database/queries";
import {CronExecutions, type CronExecution} from "@database/models/CronExecutions";

export default async function () {
    const startTime = Date.now();
    const execution: CronExecution = {
        status: 'success',
    };
    let stage: string = 'setupDatabase'

    try {
        await setupDatabase();

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

            // Check subscription difference
            stage = 'generateSubscriptionDestinations'
            const destinations = await NotificationService.generateSubscriptionDestinations(newBulletins);
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
    } finally {
        // Always record execution, even on failure
        execution.duration_ms = Date.now() - startTime;
        try {
            await CronExecutions.insert(execution);
        } catch (dbError) {
            console.error('Failed to insert cron execution record:', dbError);
        }

        // Close the database connection to prevent connection leaks
        await closeConnection();
    }

    return {status: execution.status, summary: execution.summary};
}