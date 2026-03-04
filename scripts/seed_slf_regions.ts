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
const SLF_REGIONS: MassifRow[] = [
    {code: 'CH-1100', name: 'Bernese Oberland', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-1200', name: 'Central Switzerland', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-2100', name: 'Fribourg Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-2200', name: 'Vaud Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-3100', name: 'Lower Valais', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-3200', name: 'Upper Valais', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-4100', name: 'Ticino', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-5100', name: 'Eastern Bernese Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-6100', name: 'Glarus Alps', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-7100', name: 'Graubünden North', provider: 'slf', country: 'Switzerland'},
    {code: 'CH-7200', name: 'Graubünden South', provider: 'slf', country: 'Switzerland'},
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
