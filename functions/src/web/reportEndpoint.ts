import {Request, Response} from '@google-cloud/functions-framework';
import {setupDatabase} from "@config/database";
import {MassifCache} from "@cache/MassifCache";
import {Bulletins} from "@database/models/Bulletins";
import {BulletinService} from "@services/bulletinService";
import {ReportCacheService} from "@services/reportCacheService";
import {ReportService} from "@services/reportService";
import type {ConditionsReport} from "@services/reportService";
import {WeatherService} from "@services/weatherService";
import {RouteService} from "@services/routeService";
import {renderReportPage, renderLoadingPage, renderNotAvailablePage} from "@web/reportPage";

// Eager init — same pattern as whatsappWebhook.ts
const ready = (async () => {
    await setupDatabase();
    await MassifCache.initialize();
})();

// In-flight generation promises — prevents duplicate Claude calls
const inFlight = new Map<string, Promise<ConditionsReport>>();

export async function reportPageEndpoint(req: Request, res: Response) {
    try {
        await ready;

        // Extract slug from path (e.g. /mont-blanc → mont-blanc)
        const slug = req.path.replace(/^\/|\/$/g, '');
        if (!slug) {
            res.redirect(302, 'https://conditionsreport.com/');
            return;
        }

        const massif = MassifCache.findBySlug(slug);
        if (!massif) {
            res.redirect(302, 'https://conditionsreport.com/');
            return;
        }

        // Get latest bulletin
        let bulletin = await Bulletins.getLatest(massif.code);
        if (!bulletin || bulletin.valid_to < new Date()) {
            try {
                const metadata = await BulletinService.fetchBulletinMetadata(massif.code);
                if (metadata) {
                    const fetched = await BulletinService.fetchAndStoreBulletins([{
                        massif: massif.code,
                        valid_from: metadata.validFrom,
                        valid_to: metadata.validTo,
                        risk_level: metadata.riskLevel,
                    }]);
                    if (fetched.length > 0) bulletin = fetched[0];
                }
            } catch (error) {
                console.error(`Failed to fetch bulletin for ${massif.name}:`, error);
            }
        }

        if (!bulletin) {
            res.set('Cache-Control', 'no-store');
            res.status(200).send(renderNotAvailablePage(massif));
            return;
        }

        // Check for cached report
        const cached = await ReportCacheService.getCachedReport(massif.code, bulletin.valid_from);
        if (cached) {
            res.set('Cache-Control', 'public, max-age=1800');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(renderReportPage(massif, cached, bulletin));
            return;
        }

        // No cached report — kick off generation if not already in flight
        const cacheKey = `${massif.code}:${bulletin.valid_from.toISOString()}`;
        if (!inFlight.has(cacheKey)) {
            const capturedBulletin = bulletin;
            const promise = (async () => {
                try {
                    const [weather, routes] = await Promise.all([
                        WeatherService.fetchWeatherForMassif(massif.code),
                        RouteService.fetchRoutesForMassif(massif.code),
                    ]);

                    const report = await ReportService.generateReport({
                        massifCode: massif.code,
                        massifName: massif.name,
                        riskLevel: capturedBulletin.risk_level,
                        validFrom: capturedBulletin.valid_from,
                        metadata: capturedBulletin.metadata,
                        weather,
                        routes,
                    });

                    await ReportCacheService.saveToDb(massif.code, capturedBulletin.valid_from, report);
                    ReportCacheService.setInMemory(massif.code, capturedBulletin.valid_from, report);
                    return report;
                } finally {
                    inFlight.delete(cacheKey);
                }
            })();
            inFlight.set(cacheKey, promise);
        }

        // Return loading page — meta-refresh will bring the user back in 3s
        res.set('Cache-Control', 'no-store');
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(renderLoadingPage(massif));
    } catch (error) {
        console.error('Error in reportPageEndpoint:', error);
        res.status(500).send('Internal error');
    }
}
