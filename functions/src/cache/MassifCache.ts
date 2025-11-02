import type {Massif} from "@app-types";
import {Massifs} from "@database/models/Massifs";

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
}
