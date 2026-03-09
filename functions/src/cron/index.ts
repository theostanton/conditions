import {BulletinService} from "@services/bulletinService";
import {ImageService} from "@services/imageService";
import {WeatherService} from "@services/weatherService";
import {RouteService} from "@services/routeService";
import {ReportService, type ConditionsReport} from "@services/reportService";
import {ReportCacheService} from "@services/reportCacheService";
import {NotificationService} from "./services/notificationService";
import {WhatsappNotificationService} from "@whatsapp/services/notificationService";
import {WhatsAppDelivery} from "@whatsapp/flows/delivery";
import {ContentDeliveryService} from "@services/contentDeliveryService";
import {setupDatabase, closeConnection} from "@config/database";
import {Database} from "@database/queries";
import {CronExecutions, type CronExecution} from "@database/models/CronExecutions";
import {Analytics} from "@analytics/Analytics";
import {MassifCache} from "@cache/MassifCache";
import {formatError} from "@utils/formatters";

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

        // Clear caches from any previous run (function instance may be reused)
        ImageService.clearCache();
        ContentDeliveryService.clearTelegramCache();
        WhatsAppDelivery.clearMediaCache();
        WeatherService.clearCache();
        RouteService.clearCache();
        ReportCacheService.clearCache();

        // Massifs with subscribers across all platforms (bulletins are platform-agnostic)
        stage = 'getSubscriberStats'
        const [totalSubscribers, massifsWithSubscribers] = await Promise.all([
            Database.getTotalSubscribers(),
            Database.getMassifsWithSubscribers()
        ]);
        execution.subscriber_count = totalSubscribers;
        execution.massifs_with_subscribers_count = massifsWithSubscribers.length;

        // Check Bulletin difference — pass massifs to avoid duplicate query
        stage = 'checkForNewBulletins'
        const newBulletinsResult = await BulletinService.checkForNewBulletins(massifsWithSubscribers);
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
            // Generate conditions reports for massifs that have report subscribers
            stage = 'generateReports'
            const reports = new Map<string, ConditionsReport>();
            for (const bulletin of validBulletins) {
                try {
                    // Check cache first (memory → DB)
                    const cached = await ReportCacheService.getCachedReport(bulletin.massif, bulletin.valid_from);
                    if (cached) {
                        reports.set(bulletin.massif, cached);
                        continue;
                    }

                    // Generate new report
                    const massif = MassifCache.findByCode(bulletin.massif);
                    if (!massif) continue;

                    const [weather, routes] = await Promise.all([
                        WeatherService.fetchWeatherForMassif(bulletin.massif).catch(err => {
                            console.error(`Weather fetch failed for ${massif.name}: ${formatError(err)}`);
                            return null;
                        }),
                        RouteService.fetchRoutesForMassif(bulletin.massif).catch(err => {
                            console.error(`Route fetch failed for ${massif.name}: ${formatError(err)}`);
                            return [];
                        }),
                    ]);

                    if (!weather) {
                        console.log(`Skipping report for ${massif.name} — no weather data`);
                        continue;
                    }

                    const report = await ReportService.generateReport({
                        massifCode: bulletin.massif,
                        massifName: massif.name,
                        riskLevel: bulletin.risk_level,
                        validFrom: bulletin.valid_from,
                        metadata: bulletin.metadata,
                        weather,
                        routes,
                    });

                    reports.set(bulletin.massif, report);
                    ReportCacheService.setInMemory(bulletin.massif, bulletin.valid_from, report);
                    await ReportCacheService.saveToDb(bulletin.massif, bulletin.valid_from, report);

                    console.log(`Generated report for ${massif.name} (${report.fullReport.length} chars)`);
                } catch (error) {
                    console.error(`Failed to generate report for ${bulletin.massif}: ${formatError(error)}`);
                    // Don't fail the whole cron — report generation is best-effort
                }
            }
            console.log(`Generated ${reports.size} reports`);

            // Check subscription difference
            stage = 'generateSubscriptionDestinations'
            const destinations = await NotificationService.generateSubscriptionDestinations(validBulletins);
            console.log(`destinations=${JSON.stringify(destinations)}`);

            // Send to Telegram subscribers
            stage = 'telegramSend'
            const telegramDelivered = await NotificationService.send(destinations, reports);

            // WhatsApp delivery
            stage = 'whatsappGenerateDestinations'
            const whatsappDestinations = await WhatsappNotificationService.generateSubscriptionDestinations(validBulletins);
            console.log(`whatsappDestinations=${JSON.stringify(whatsappDestinations)}`);

            stage = 'whatsappSend'
            const whatsappDelivered = await WhatsappNotificationService.send(whatsappDestinations, reports);

            execution.bulletins_delivered_count = telegramDelivered + whatsappDelivered;

            execution.summary = `Deliveries made (telegram:${telegramDelivered}, whatsapp:${whatsappDelivered}). Reports: ${reports.size}. ${newBulletinsSummary}`;
        } else {
            execution.bulletins_delivered_count = 0
            execution.summary = `No deliveries necessary. ${newBulletinsSummary}`;
        }

    } catch (error) {
        execution.status = 'failed';
        execution.error_message = error instanceof Error ? error.message : String(error);
        execution.summary = `Failed at ${stage}: ${execution.error_message}`;
        console.error(`Error in main cron logic on ${stage}: ${formatError(error)}`);

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
            console.error(`Failed to insert cron execution record: ${formatError(dbError)}`);
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