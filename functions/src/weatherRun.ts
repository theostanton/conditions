import {setupDatabase} from "@config/database";
import {MassifCache} from "@cache/MassifCache";
import {WeatherService} from "@services/weatherService";

async function main() {
    await setupDatabase();
    await MassifCache.initialize();

    // Fetch weather for Mont-Blanc (code: MONT_BLANC or first available massif)
    const massifs = MassifCache.getAll();
    const testMassif = massifs.find(m => m.name.toLowerCase().includes('mont-blanc')) || massifs[0];

    if (!testMassif) {
        console.error('No massifs found');
        return;
    }

    console.log(`Fetching weather for ${testMassif.name} (${testMassif.code})...\n`);

    const weather = await WeatherService.fetchWeatherForMassif(testMassif.code);

    console.log(`Sunrise: ${weather.sunrise}`);
    console.log(`Sunset: ${weather.sunset}`);
    console.log(`Daily snowfall: ${weather.dailySnowfallCm}cm`);
    console.log(`Freezing levels: ${weather.freezingLevelM.slice(0, 6).join(', ')}m\n`);

    console.log('Hourly forecast (first 12 hours):');
    for (const hour of weather.hourly.slice(0, 12)) {
        console.log(`\n  ${hour.time}`);
        for (const [elev, data] of Object.entries(hour.elevations)) {
            console.log(`    ${elev}m: ${data.temperatureC}°C, wind ${data.windSpeedKmh}km/h`);
        }
        console.log(`    Precip: ${hour.precipitationMm}mm, Snow: ${hour.snowfallCm}cm, Cloud: ${hour.cloudCoverPercent}%`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
