import {setupDatabase} from "@config/database";
import {MassifCache} from "@cache/MassifCache";
import {RouteService} from "@services/routeService";

async function main() {
    await setupDatabase();
    await MassifCache.initialize();

    const massifs = MassifCache.getAll();
    const testMassif = massifs.find(m => m.name.toLowerCase().includes('mont-blanc')) || massifs[0];

    if (!testMassif) {
        console.error('No massifs found');
        return;
    }

    console.log(`Fetching ski touring routes for ${testMassif.name} (${testMassif.code})...\n`);

    const routes = await RouteService.fetchRoutesForMassif(testMassif.code);

    console.log(`Found ${routes.length} routes:\n`);
    for (const route of routes) {
        console.log(`  ${route.name} (${route.difficulty})`);
        if (route.elevationMin || route.elevationMax) {
            console.log(`    Elevation: ${route.elevationMin ?? '?'}m - ${route.elevationMax ?? '?'}m`);
        }
        if (route.aspects?.length) {
            console.log(`    Aspects: ${route.aspects.join(', ')}`);
        }
        console.log(`    ${route.url}\n`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
