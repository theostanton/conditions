import {setupDatabase} from "@config/database";
import {MassifCache} from "@cache/MassifCache";
import {WeatherService} from "@services/weatherService";
import {RouteService} from "@services/routeService";
import {ReportService} from "@services/reportService";
import {Database} from "@database/queries";

async function main() {
    await setupDatabase();
    await MassifCache.initialize();

    const massifs = MassifCache.getAll();
    const testMassif = massifs.find(m => m.name.toLowerCase().includes('mont-blanc')) || massifs[0];

    if (!testMassif) {
        console.error('No massifs found');
        return;
    }

    console.log(`Generating conditions report for ${testMassif.name} (${testMassif.code})...\n`);

    // Fetch weather
    console.log('Fetching weather...');
    const weather = await WeatherService.fetchWeatherForMassif(testMassif.code);
    console.log(`  Sunrise: ${weather.sunrise}, Sunset: ${weather.sunset}`);
    console.log(`  Snowfall: ${weather.dailySnowfallCm}cm\n`);

    // Fetch routes
    console.log('Fetching routes...');
    let routes: Awaited<ReturnType<typeof RouteService.fetchRoutesForMassif>> = [];
    try {
        routes = await RouteService.fetchRoutesForMassif(testMassif.code);
        console.log(`  Found ${routes.length} routes\n`);
    } catch (error) {
        console.warn('  Routes fetch failed, continuing without routes\n');
    }

    // Get latest bulletin metadata
    console.log('Fetching bulletin metadata...');
    const bulletins = await Database.getValidBulletins();
    const bulletin = bulletins.find(b => b.massif === testMassif.code);
    const metadata = bulletin?.metadata;
    const riskLevel = bulletin?.risk_level ?? undefined;
    const validFrom = bulletin?.valid_from ?? new Date();
    console.log(`  Risk level: ${riskLevel ?? 'N/A'}`);
    console.log(`  Valid from: ${validFrom}\n`);

    // Generate report
    console.log('Generating report with Claude...\n');
    const report = await ReportService.generateReport({
        massifCode: testMassif.code,
        massifName: testMassif.name,
        riskLevel,
        validFrom,
        metadata,
        weather,
        routes,
    });

    console.log('=== TELEGRAM REPORT ===');
    console.log(report.fullReport);
    console.log(`\n(${report.fullReport.length} chars)\n`);

    console.log('=== WHATSAPP FIELDS ===');
    for (const [key, value] of Object.entries(report.whatsapp)) {
        console.log(`  ${key.toUpperCase()}: ${value}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
