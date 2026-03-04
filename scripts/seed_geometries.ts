import 'dotenv/config';
import database from "./database";
import {union} from "@turf/union";
import {featureCollection} from "@turf/helpers";
import type {Feature, FeatureCollection, MultiPolygon, Polygon} from "geojson";

const EAWS_GEOJSON_BASE = 'https://regions.avalanches.org/micro-regions';

/**
 * EAWS region file mapping.
 * Each entry maps a massif code to the GeoJSON file that contains its micro-regions.
 * For most EAWS regions, the file is named {regionCode}_micro-regions.geojson.json.
 * For Swiss regions, all are in a single CH_micro-regions.geojson.json file.
 */
interface RegionSource {
    code: string;
    file: string;       // GeoJSON filename (without base URL)
    prefix: string;     // Prefix to filter micro-regions by
}

const REGION_SOURCES: RegionSource[] = [
    // Euregio
    {code: 'AT-07', file: 'AT-07_micro-regions.geojson.json', prefix: 'AT-07'},
    {code: 'IT-32-BZ', file: 'IT-32-BZ_micro-regions.geojson.json', prefix: 'IT-32-BZ'},
    {code: 'IT-32-TN', file: 'IT-32-TN_micro-regions.geojson.json', prefix: 'IT-32-TN'},

    // Lawinen
    {code: 'AT-02', file: 'AT-02_micro-regions.geojson.json', prefix: 'AT-02'},
    {code: 'AT-03', file: 'AT-03_micro-regions.geojson.json', prefix: 'AT-03'},
    {code: 'AT-04', file: 'AT-04_micro-regions.geojson.json', prefix: 'AT-04'},
    {code: 'AT-05', file: 'AT-05_micro-regions.geojson.json', prefix: 'AT-05'},
    {code: 'AT-06', file: 'AT-06_micro-regions.geojson.json', prefix: 'AT-06'},
    {code: 'AT-08', file: 'AT-08_micro-regions.geojson.json', prefix: 'AT-08'},
    {code: 'DE-BY', file: 'DE-BY_micro-regions.geojson.json', prefix: 'DE-BY'},
    {code: 'SI', file: 'SI_micro-regions.geojson.json', prefix: 'SI'},

    // SLF (all from single CH file)
    {code: 'CH-11', file: 'CH_micro-regions.geojson.json', prefix: 'CH-11'},
    {code: 'CH-12', file: 'CH_micro-regions.geojson.json', prefix: 'CH-12'},
    {code: 'CH-13', file: 'CH_micro-regions.geojson.json', prefix: 'CH-13'},
    {code: 'CH-21', file: 'CH_micro-regions.geojson.json', prefix: 'CH-21'},
    {code: 'CH-22', file: 'CH_micro-regions.geojson.json', prefix: 'CH-22'},
    {code: 'CH-31', file: 'CH_micro-regions.geojson.json', prefix: 'CH-31'},
    {code: 'CH-32', file: 'CH_micro-regions.geojson.json', prefix: 'CH-32'},
    {code: 'CH-33', file: 'CH_micro-regions.geojson.json', prefix: 'CH-33'},
    {code: 'CH-41', file: 'CH_micro-regions.geojson.json', prefix: 'CH-41'},
    {code: 'CH-42', file: 'CH_micro-regions.geojson.json', prefix: 'CH-42'},
    {code: 'CH-51', file: 'CH_micro-regions.geojson.json', prefix: 'CH-51'},
    {code: 'CH-52', file: 'CH_micro-regions.geojson.json', prefix: 'CH-52'},
    {code: 'CH-61', file: 'CH_micro-regions.geojson.json', prefix: 'CH-61'},
    {code: 'CH-62', file: 'CH_micro-regions.geojson.json', prefix: 'CH-62'},
    {code: 'CH-71', file: 'CH_micro-regions.geojson.json', prefix: 'CH-71'},
    {code: 'CH-72', file: 'CH_micro-regions.geojson.json', prefix: 'CH-72'},
    {code: 'CH-81', file: 'CH_micro-regions.geojson.json', prefix: 'CH-81'},
    {code: 'CH-82', file: 'CH_micro-regions.geojson.json', prefix: 'CH-82'},
];

// Cache fetched GeoJSON files to avoid re-downloading (CH file used 18 times)
const fileCache = new Map<string, any>();

async function fetchGeoJSON(file: string): Promise<any> {
    if (fileCache.has(file)) return fileCache.get(file);

    const url = `${EAWS_GEOJSON_BASE}/${file}`;
    console.log(`Fetching ${url}...`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
    const data = await resp.json();
    fileCache.set(file, data);
    return data;
}

/**
 * Union multiple GeoJSON polygon/multipolygon features into a single geometry.
 * Turf v7 union() takes a FeatureCollection and requires at least 2 geometries.
 */
function dissolve(features: Feature<Polygon | MultiPolygon>[]): object | null {
    if (features.length === 0) return null;
    if (features.length === 1) return features[0].geometry;

    const fc = featureCollection(features) as FeatureCollection<Polygon | MultiPolygon>;
    const result = union(fc);
    return result ? result.geometry : null;
}

async function main(): Promise<void> {
    const client = await database();
    let updated = 0;
    let failed = 0;

    for (const source of REGION_SOURCES) {
        try {
            const geojson = await fetchGeoJSON(source.file);

            // Filter active features matching our prefix
            const matching = geojson.features.filter((f: any) => {
                const id: string = f.properties?.id || '';
                const isActive = !f.properties?.valid_until;
                return isActive && id.startsWith(source.prefix);
            });

            if (matching.length === 0) {
                console.warn(`  ${source.code}: no matching micro-regions found`);
                failed++;
                continue;
            }

            // Dissolve into single geometry
            const geometry = dissolve(matching);
            if (!geometry) {
                console.warn(`  ${source.code}: dissolve failed`);
                failed++;
                continue;
            }

            // Update database
            await client.query(
                `UPDATE massifs SET geometry = $1::jsonb WHERE code = $2`,
                [JSON.stringify(geometry), source.code]
            );
            console.log(`  ${source.code}: merged ${matching.length} micro-regions`);
            updated++;
        } catch (err) {
            console.error(`  ${source.code}: error -`, err);
            failed++;
        }
    }

    console.log(`\nDone: ${updated} updated, ${failed} failed`);
    await client.end();
}

main().then();
