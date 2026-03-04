import axios from "axios";
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";
import type {ContentTypes} from "@app-types";
import type {BulletinMetadata, BulletinProvider} from "./types";
import {parseBulletinForRegion} from "./caaml/parser";
import type {CAAMLv6Response} from "./caaml/parser";

const SLF_BULLETIN_URL = 'https://aws.slf.ch/api/bulletin/caaml/en/json';
const SLF_PDF_URL = 'https://aws.slf.ch/api/bulletin/document/';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * SLF (Swiss avalanche service) provider.
 *
 * Unlike other EAWS providers, SLF has a single endpoint returning ALL bulletins
 * for Switzerland, and a single PDF covering the entire country. We cache the
 * response to avoid redundant requests during a cron run.
 */
export class SlfProvider implements BulletinProvider {
    readonly id = 'slf';
    readonly deliveryMode = 'pdf' as const;

    private cachedResponse: { data: CAAMLv6Response; fetchedAt: number } | null = null;

    private async fetchAllBulletins(): Promise<CAAMLv6Response> {
        if (this.cachedResponse && Date.now() - this.cachedResponse.fetchedAt < CACHE_TTL_MS) {
            return this.cachedResponse.data;
        }

        const response = await axios.get<CAAMLv6Response>(SLF_BULLETIN_URL, {timeout: 15000});
        this.cachedResponse = {data: response.data, fetchedAt: Date.now()};
        return response.data;
    }

    async fetchBulletinMetadata(regionCode: string): Promise<BulletinMetadata | undefined> {
        try {
            const allBulletins = await this.fetchAllBulletins();
            return parseBulletinForRegion(allBulletins, regionCode);
        } catch (error) {
            const massifName = MassifCache.findByCode(regionCode)?.name || `region ${regionCode}`;
            console.error(`[slf] Failed to fetch bulletin metadata for ${massifName}:`, error);

            await Analytics.sendError(
                error as Error,
                `SlfProvider.fetchBulletinMetadata: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    async fetchBulletin(_regionCode: string, filename: string): Promise<string | null> {
        // SLF delivers a single country-wide PDF regardless of region
        const resp = await fetch(SLF_PDF_URL);

        if (resp.ok && resp.body) {
            console.log('[slf] Writing to file:', filename);
            const writer = createWriteStream(filename);
            // @ts-ignore
            Readable.fromWeb(resp.body).pipe(writer);
            await new Promise<void>((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', reject);
            });
            console.log('[slf] Saved');
            return filename;
        } else {
            console.log(`[slf] Failed to fetch PDF: ${resp.status}`);
            return null;
        }
    }

    getAvailableContentTypes(): Array<keyof ContentTypes> {
        return ['bulletin'];
    }
}
