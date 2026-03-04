import type {BulletinMetadata} from "@providers/types";

/**
 * CAAMLv6 JSON response shape (subset relevant to our parsing).
 * Full spec: https://gitlab.com/eaws/eaws-regions
 */
export interface CAAMLv6Response {
    bulletins: CAAMLv6Bulletin[];
}

interface CAAMLv6Bulletin {
    bulletinID?: string;
    publicationTime?: string;
    validTime?: {
        startTime?: string;
        endTime?: string;
    };
    dangerRatings?: CAAMLv6DangerRating[];
    regions?: CAAMLv6Region[];
}

interface CAAMLv6DangerRating {
    mainValue: string;
    elevation?: { lowerBound?: string; upperBound?: string };
}

interface CAAMLv6Region {
    regionID: string;
    name?: string;
}

const DANGER_TEXT_TO_NUMBER: Record<string, number> = {
    'low': 1,
    'moderate': 2,
    'considerable': 3,
    'high': 4,
    'very_high': 5,
};

/** Convert CAAMLv6 text danger rating to numeric 1-5 scale. */
export function parseDangerRating(text: string): number | undefined {
    return DANGER_TEXT_TO_NUMBER[text.toLowerCase()];
}

/**
 * Find the bulletin covering a specific region and extract metadata.
 *
 * Each CAAMLv6 file contains multiple bulletins, each with a `regions[]` array.
 * We scan until we find one whose regions include our target code, then take
 * the **maximum** dangerRating mainValue as the overall risk level.
 */
export type CAAMLv6ParseResult = BulletinMetadata & { bulletinID?: string };

export function parseBulletinForRegion(json: CAAMLv6Response, regionCode: string): CAAMLv6ParseResult | undefined {
    for (const bulletin of json.bulletins) {
        // Prefix match: our seeded codes (e.g. "AT-07", "CH-11") are prefixes
        // of micro-region IDs in the bulletin (e.g. "AT-07-14-01", "CH-1111")
        const matchesRegion = bulletin.regions?.some(r => r.regionID.startsWith(regionCode));
        if (!matchesRegion) continue;

        const validFrom = bulletin.validTime?.startTime
            ? new Date(bulletin.validTime.startTime)
            : new Date();

        const validTo = bulletin.validTime?.endTime
            ? new Date(bulletin.validTime.endTime)
            : new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);

        // Take the max danger rating across all elevation bands
        let riskLevel: number | undefined;
        if (bulletin.dangerRatings) {
            for (const dr of bulletin.dangerRatings) {
                const level = parseDangerRating(dr.mainValue);
                if (level !== undefined && (riskLevel === undefined || level > riskLevel)) {
                    riskLevel = level;
                }
            }
        }

        return {validFrom, validTo, riskLevel, bulletinID: bulletin.bulletinID};
    }

    return undefined;
}
