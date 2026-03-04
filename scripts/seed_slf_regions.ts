import 'dotenv/config';
import format from "pg-format";
import database from "./database";
import {MassifRow} from "./types";

/**
 * Seed Swiss avalanche warning regions for SLF.
 *
 * SLF uses micro-region codes (CH-XXYY), but users don't think in micro-regions.
 * We seed higher-level Alpine groups, each with a representative micro-region code.
 * The SLF parser searches the bulk bulletin response for the matching region.
 *
 * Groups based on SLF's own regional breakdown:
 * https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html
 */
/**
 * SLF micro-regions use CH-XXYY format. We group at the CH-XX level.
 * E.g. CH-11 matches CH-1111, CH-1112, CH-1113, CH-1114, CH-1121, CH-1122
 */
const SLF_REGIONS: MassifRow[] = [
    {code: 'CH-11', name: 'Bernese Oberland', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-12', name: 'Central Switzerland', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-13', name: 'Bern South', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-21', name: 'Fribourg Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-22', name: 'Vaud Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-31', name: 'Lower Valais', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-32', name: 'Upper Valais', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-33', name: 'Simplon', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-41', name: 'Northern Ticino', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-42', name: 'Southern Ticino', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-51', name: 'Eastern Bernese Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-52', name: 'Uri / Schwyz Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-61', name: 'Glarus Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-62', name: 'Appenzell Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-71', name: 'Graubünden North', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-72', name: 'Graubünden South', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-81', name: 'Eastern Graubünden', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-82', name: 'Engadin', provider: 'slf', country: 'Switzerland'},
];

async function insert(massifs: MassifRow[]): Promise<void> {
    const client = await database();

    const values = massifs.map(massif => [
        massif.code,
        massif.name,
        massif.departement || null,
        massif.mountain || null,
        massif.geometry ? JSON.stringify(massif.geometry) : null,
        massif.provider || 'meteofrance',
        massif.country || 'France',
    ]);

    try {
        await client.query(format(
            'INSERT INTO massifs (code, name, departement, mountain, geometry, provider, country) VALUES %L ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, departement = EXCLUDED.departement, mountain = EXCLUDED.mountain, geometry = EXCLUDED.geometry::jsonb, provider = EXCLUDED.provider, country = EXCLUDED.country',
            values
        ));
        console.log(`Inserted/updated ${massifs.length} SLF regions`);
    } catch (err) {
        console.error('Insert failed:', err);
    }

    await client.end();
}

async function main(): Promise<void> {
    await insert(SLF_REGIONS);
}

main().then();
