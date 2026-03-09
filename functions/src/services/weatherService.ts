import axios from "axios";
import {MassifCache} from "@cache/MassifCache";
import {getCentroid} from "@utils/geo";
import {Analytics} from "@analytics/Analytics";

export type WeatherData = {
    hourly: HourlyWeather[];
    freezingLevelM: number[];
    dailySnowfallCm: number;
};

export type HourlyWeather = {
    time: string;
    elevations: {
        [meters: number]: {
            temperatureC: number;
            windSpeedKmh: number;
            windDirectionDeg: number;
        };
    };
    precipitationMm: number;
    snowfallCm: number;
    cloudCoverPercent: number;
    visibility: number;
};

export type SunTimes = {
    sunrise: string;
    sunset: string;
};

export type WeatherResult = WeatherData & SunTimes;

const ELEVATIONS = [1500, 2000, 2500, 3000];

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// In-memory cache per cron run, same pattern as ImageService.imageCache
const weatherCache = new Map<string, Promise<WeatherResult>>();

export namespace WeatherService {

    export function clearCache(): void {
        weatherCache.clear();
    }

    export async function fetchWeatherForMassif(massifCode: string): Promise<WeatherResult> {
        const cached = weatherCache.get(massifCode);
        if (cached) return cached;

        const promise = fetchFromApi(massifCode);
        weatherCache.set(massifCode, promise);

        promise.catch(() => weatherCache.delete(massifCode));

        return promise;
    }

    async function fetchFromApi(massifCode: string): Promise<WeatherResult> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif?.geometry) {
            throw new Error(`No geometry for massif ${massifCode}`);
        }

        const [lng, lat] = getCentroid(massif.geometry);

        try {
            // Fetch weather for each elevation level in parallel
            const elevationResults = await Promise.all(
                ELEVATIONS.map(elevation => fetchForElevation(lat, lng, elevation))
            );

            // Fetch freezing level and sun times (at base elevation)
            const metaResponse = await axios.get(OPEN_METEO_BASE, {
                params: {
                    latitude: lat.toFixed(4),
                    longitude: lng.toFixed(4),
                    hourly: "freezing_level_height",
                    daily: "sunrise,sunset,snowfall_sum",
                    timezone: "Europe/Paris",
                    forecast_days: 1,
                },
                timeout: 10000,
            });

            const freezingLevelM: number[] = metaResponse.data.hourly.freezing_level_height || [];
            const dailySnowfallCm: number = metaResponse.data.daily?.snowfall_sum?.[0] ?? 0;
            const sunrise: string = metaResponse.data.daily?.sunrise?.[0] ?? "";
            const sunset: string = metaResponse.data.daily?.sunset?.[0] ?? "";

            // Merge elevation data into hourly structure
            const hourlyCount = elevationResults[0].length;
            const hourly: HourlyWeather[] = [];

            for (let i = 0; i < hourlyCount; i++) {
                const elevations: HourlyWeather["elevations"] = {};
                for (let e = 0; e < ELEVATIONS.length; e++) {
                    elevations[ELEVATIONS[e]] = elevationResults[e][i];
                }

                hourly.push({
                    time: elevationResults[0][i].time,
                    elevations,
                    precipitationMm: elevationResults[0][i].precipitationMm,
                    snowfallCm: elevationResults[0][i].snowfallCm,
                    cloudCoverPercent: elevationResults[0][i].cloudCoverPercent,
                    visibility: elevationResults[0][i].visibility,
                });
            }

            return {hourly, freezingLevelM, dailySnowfallCm, sunrise, sunset};
        } catch (error) {
            const massifName = MassifCache.findByCode(massifCode)?.name || `massif ${massifCode}`;
            console.error(`Failed to fetch weather for ${massifName}:`, error);

            await Analytics.sendError(
                error as Error,
                `WeatherService.fetchWeatherForMassif: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    type ElevationHourly = {
        time: string;
        temperatureC: number;
        windSpeedKmh: number;
        windDirectionDeg: number;
        precipitationMm: number;
        snowfallCm: number;
        cloudCoverPercent: number;
        visibility: number;
    };

    async function fetchForElevation(lat: number, lng: number, elevation: number): Promise<ElevationHourly[]> {
        const response = await axios.get(OPEN_METEO_BASE, {
            params: {
                latitude: lat.toFixed(4),
                longitude: lng.toFixed(4),
                elevation,
                hourly: "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,snowfall,cloud_cover,visibility",
                timezone: "Europe/Paris",
                forecast_days: 1,
            },
            timeout: 10000,
        });

        const h = response.data.hourly;
        const count = h.time?.length ?? 0;
        const result: ElevationHourly[] = [];

        for (let i = 0; i < count; i++) {
            result.push({
                time: h.time[i],
                temperatureC: h.temperature_2m?.[i] ?? 0,
                windSpeedKmh: h.wind_speed_10m?.[i] ?? 0,
                windDirectionDeg: h.wind_direction_10m?.[i] ?? 0,
                precipitationMm: h.precipitation?.[i] ?? 0,
                snowfallCm: h.snowfall?.[i] ?? 0,
                cloudCoverPercent: h.cloud_cover?.[i] ?? 0,
                visibility: h.visibility?.[i] ?? 0,
            });
        }

        return result;
    }
}
