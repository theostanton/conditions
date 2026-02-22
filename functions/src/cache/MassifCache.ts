import type {Massif} from "@app-types";
import {Massifs} from "@database/models/Massifs";
import {pointInGeometry} from "@utils/geo";

export namespace MassifCache {

    let allMassifs: Massif[] = [];
    let mountainsCache: string[] = [];
    let massifsByMountain: Map<string, Massif[]> = new Map();

    export async function initialize(): Promise<void> {
        console.log('Initializing massif cache...');

        // Fetch all massifs once
        allMassifs = await Massifs.getAll();

        // Extract unique mountains (excluding null/undefined)
        const mountains = allMassifs
            .map(m => m.mountain)
            .filter((m): m is string => !!m);
        mountainsCache = [...new Set(mountains)].sort();

        // Pre-group massifs by mountain for O(1) lookups
        for (const mountain of mountainsCache) {
            const massifsForMountain = allMassifs
                .filter(m => m.mountain === mountain)
                .sort((a, b) => a.name.localeCompare(b.name));
            massifsByMountain.set(mountain, massifsForMountain);
        }

        console.log(`Cached ${allMassifs.length} massifs across ${mountainsCache.length} mountains`);
    }

    export function getMountains(): string[] {
        return mountainsCache;
    }

    export function getByMountain(mountain: string): Massif[] {
        return massifsByMountain.get(mountain) || [];
    }

    export function getAll(): Massif[] {
        return allMassifs;
    }

    export function findByCode(code: number): Massif | undefined {
        return allMassifs.find(m => m.code === code);
    }

    export function findByName(name: string): Massif | undefined {
        return allMassifs.find(m => m.name === name);
    }

    export function findByLocation(lat: number, lng: number): Massif | undefined {
        return allMassifs.find(m =>
            m.geometry && pointInGeometry([lng, lat], m.geometry)
        );
    }

    export function searchByName(query: string): Massif[] {
        const normalized = normalize(query);
        if (normalized.length < 2) return [];

        // Exact normalized match first
        const exact = allMassifs.find(m => normalize(m.name) === normalized);
        if (exact) return [exact];

        // Substring match: query in massif name or massif name in query
        return allMassifs.filter(m => {
            const name = normalize(m.name);
            return name.includes(normalized) || normalized.includes(name);
        });
    }
}

function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[-_]/g, ' ')                             // hyphens to spaces
        .replace(/\s+/g, ' ')                              // collapse whitespace
        .trim();
}
