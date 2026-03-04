import axios from "axios";
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";
import type {ContentTypes} from "@app-types";
import type {BulletinMetadata, BulletinProvider} from "./types";
import {parseBulletinForRegion} from "./caaml/parser";
import type {CAAMLv6Response} from "./caaml/parser";

/**
 * Generic EAWS provider for services using the static CAAMLv6 bulletin format.
 * Used by both avalanche.report (Euregio) and lawinen-warnung.eu (Austrian states).
 */
export class EawsProvider implements BulletinProvider {
    readonly id: string;
    readonly deliveryMode = 'pdf' as const;

    private readonly baseUrl: string;
    private readonly lang: string;

    // Cache bulletin IDs from metadata calls, used to construct PDF URLs
    private bulletinIds = new Map<string, string>();

    constructor(id: string, baseUrl: string, lang: string) {
        this.id = id;
        this.baseUrl = baseUrl;
        this.lang = lang;
    }

    async fetchBulletinMetadata(regionCode: string): Promise<BulletinMetadata | undefined> {
        try {
            const url = `${this.baseUrl}/bulletins/latest/${regionCode}_${this.lang}_CAAMLv6.json`;
            const response = await axios.get<CAAMLv6Response>(url, {timeout: 15000});
            const result = parseBulletinForRegion(response.data, regionCode);
            if (result?.bulletinID) {
                this.bulletinIds.set(regionCode, result.bulletinID);
            }
            return result;
        } catch (error) {
            const massifName = MassifCache.findByCode(regionCode)?.name || `region ${regionCode}`;
            console.error(`[${this.id}] Failed to fetch bulletin metadata for ${massifName}:`, error);

            await Analytics.sendError(
                error as Error,
                `EawsProvider(${this.id}).fetchBulletinMetadata: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    async fetchBulletin(regionCode: string, filename: string): Promise<string | null> {
        // PDF URL uses the bulletin UUID: {regionCode}_{bulletinID}.pdf
        const bulletinId = this.bulletinIds.get(regionCode);
        if (!bulletinId) {
            console.error(`[${this.id}] No cached bulletin ID for ${regionCode}, fetching metadata first`);
            const metadata = await this.fetchBulletinMetadata(regionCode);
            if (!metadata) return null;
        }
        const bid = this.bulletinIds.get(regionCode);
        if (!bid) {
            console.error(`[${this.id}] Still no bulletin ID for ${regionCode}`);
            return null;
        }
        const url = `${this.baseUrl}/bulletins/latest/${regionCode}_${bid}.pdf`;
        const resp = await fetch(url);

        if (resp.ok && resp.body) {
            console.log(`[${this.id}] Writing to file:`, filename);
            const writer = createWriteStream(filename);
            // @ts-ignore
            Readable.fromWeb(resp.body).pipe(writer);
            await new Promise<void>((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', reject);
            });
            console.log(`[${this.id}] Saved`);
            return filename;
        } else {
            console.log(`[${this.id}] Failed to fetch PDF for ${regionCode}: ${resp.status}`);
            return null;
        }
    }

    getAvailableContentTypes(): Array<keyof ContentTypes> {
        return ['bulletin'];
    }
}
