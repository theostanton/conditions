import {getClient} from "@config/database";
import {Analytics} from "@analytics/Analytics";
import type {ConditionsReport} from "@services/reportService";

// In-memory cache within a cron run
const memoryCache = new Map<string, ConditionsReport>();

function cacheKey(massifCode: string, validFrom: Date): string {
    return `${massifCode}:${validFrom.toISOString()}`;
}

export namespace ReportCacheService {

    export function clearCache(): void {
        memoryCache.clear();
    }

    export function getFromMemory(massifCode: string, validFrom: Date): ConditionsReport | undefined {
        return memoryCache.get(cacheKey(massifCode, validFrom));
    }

    export function setInMemory(massifCode: string, validFrom: Date, report: ConditionsReport): void {
        memoryCache.set(cacheKey(massifCode, validFrom), report);
    }

    export async function getFromDb(massifCode: string, validFrom: Date): Promise<ConditionsReport | null> {
        try {
            const client = await getClient();
            const result = await client.query(
                `SELECT report_full, report_json FROM conditions_reports
                 WHERE massif = $1 AND bulletin_valid_from = $2
                 LIMIT 1`,
                [massifCode, validFrom]
            );

            if (result.rows.length === 0) return null;

            const row = result.rows[0];
            const reportJson = row.get('report_json') as string;
            try {
                return JSON.parse(reportJson) as ConditionsReport;
            } catch {
                // Fallback for old rows before whatsapp fields were added
                return {
                    fullReport: row.get('report_full') as string,
                    whatsapp: {risk: '', weather: '', snow: '', tip: ''},
                };
            }
        } catch (error) {
            console.error(`Failed to read cached report for ${massifCode}:`, error);
            return null;
        }
    }

    export async function saveToDb(
        massifCode: string,
        validFrom: Date,
        report: ConditionsReport,
        promptVersion: number = 1
    ): Promise<void> {
        try {
            const client = await getClient();
            await client.query(
                `INSERT INTO conditions_reports (massif, bulletin_valid_from, report_full, report_short, report_json, prompt_version)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (massif, bulletin_valid_from) DO UPDATE SET
                    report_full = $3,
                    report_short = $4,
                    report_json = $5,
                    prompt_version = $6,
                    generated_at = NOW()`,
                [massifCode, validFrom, report.fullReport, Object.values(report.whatsapp).join(' | '), JSON.stringify(report), promptVersion]
            );
        } catch (error) {
            console.error(`Failed to save report for ${massifCode}:`, error);
            await Analytics.sendError(
                error as Error,
                `ReportCacheService.saveToDb: ${massifCode}`
            ).catch(err => console.error('Failed to send error analytics:', err));
        }
    }

    /**
     * Get a report for a massif, checking memory → DB → returning null.
     */
    export async function getCachedReport(massifCode: string, validFrom: Date): Promise<ConditionsReport | null> {
        // Check memory first
        const memCached = getFromMemory(massifCode, validFrom);
        if (memCached) return memCached;

        // Check DB
        const dbCached = await getFromDb(massifCode, validFrom);
        if (dbCached) {
            setInMemory(massifCode, validFrom, dbCached);
            return dbCached;
        }

        return null;
    }
}
