import {MassifCache} from "@cache/MassifCache";
import {MeteoFranceProvider} from "./meteoFranceProvider";
import {EawsProvider} from "./eawsProvider";
import {SlfProvider} from "./slfProvider";
import type {BulletinProvider} from "./types";

const providers = new Map<string, BulletinProvider>();

// Register built-in providers
providers.set('meteofrance', new MeteoFranceProvider());
providers.set('euregio', new EawsProvider('euregio', 'https://static.avalanche.report', 'en'));
providers.set('lawinen', new EawsProvider('lawinen', 'https://static.lawinen-warnung.eu', 'en'));
providers.set('slf', new SlfProvider());

/** Get a provider by its ID. */
export function getProvider(providerId: string): BulletinProvider | undefined {
    return providers.get(providerId);
}

/** Get the provider responsible for a given region code. */
export function getProviderForRegion(regionCode: string): BulletinProvider | undefined {
    const massif = MassifCache.findByCode(regionCode);
    if (!massif) return undefined;
    return providers.get(massif.provider ?? 'meteofrance');
}

/** Register an additional provider (for future EAWS, NAC, etc.). */
export function registerProvider(provider: BulletinProvider): void {
    providers.set(provider.id, provider);
}
