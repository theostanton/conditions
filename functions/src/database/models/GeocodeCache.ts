import {getClient} from "@config/database";

export namespace GeocodeCache {

    export async function lookup(query: string): Promise<{ massifCode: number } | null> {
        const client = await getClient();
        const result = await client.query(
            "SELECT massif_code FROM geocode_cache WHERE query = $1 LIMIT 1",
            [normalize(query)],
        );
        if (result.rows.length === 0) return null;
        return {massifCode: result.rows[0].get('massif_code') as number};
    }

    export async function store(query: string, massifCode: number, lat: number, lng: number): Promise<void> {
        const client = await getClient();
        await client.query(
            "INSERT INTO geocode_cache (query, massif_code, lat, lng) VALUES ($1, $2, $3, $4) ON CONFLICT (query) DO NOTHING",
            [normalize(query), massifCode, lat, lng],
        );
    }
}

function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
