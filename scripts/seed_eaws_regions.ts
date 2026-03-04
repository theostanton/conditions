import 'dotenv/config';
import format from "pg-format";
import database from "./database";
import {MassifRow} from "./types";

/**
 * Seed EAWS regions for Euregio (avalanche.report) and lawinen-warnung.eu.
 *
 * Euregio covers Tirol, South Tyrol, and Trentino.
 * Lawinen-warnung.eu covers the remaining Austrian states, Bavaria, and Slovenia.
 */
const EAWS_REGIONS: MassifRow[] = [
    // --- Euregio (avalanche.report) ---
    {code: 'AT-07', name: 'Tirol', provider: 'euregio', country: 'Austria'},
    {code: 'IT-32-BZ', name: 'South Tyrol', provider: 'euregio', country: 'Italy'},
    {code: 'IT-32-TN', name: 'Trentino', provider: 'euregio', country: 'Italy'},

    // --- Lawinen-warnung.eu ---
    {code: 'AT-02', name: 'Carinthia', provider: 'lawinen', country: 'Austria'},
    {code: 'AT-03', name: 'Lower Austria', provider: 'lawinen', country: 'Austria'},
    {code: 'AT-04', name: 'Upper Austria', provider: 'lawinen', country: 'Austria'},
    {code: 'AT-05', name: 'Salzburg', provider: 'lawinen', country: 'Austria'},
    {code: 'AT-06', name: 'Styria', provider: 'lawinen', country: 'Austria'},
    {code: 'AT-08', name: 'Vorarlberg', provider: 'lawinen', country: 'Austria'},
    {code: 'DE-BY', name: 'Bavaria', provider: 'lawinen', country: 'Germany'},
    {code: 'SI', name: 'Slovenia', provider: 'lawinen', country: 'Slovenia'},
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
        console.log(`Inserted/updated ${massifs.length} EAWS regions`);
    } catch (err) {
        console.error('Insert failed:', err);
    }

    await client.end();
}

async function main(): Promise<void> {
    await insert(EAWS_REGIONS);
}

main().then();
