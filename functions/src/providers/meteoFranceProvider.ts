import axios, {AxiosHeaders} from "axios";
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {XMLParser} from "fast-xml-parser";
import {METEOFRANCE_TOKEN} from "@config/envs";
import {MassifCache} from "@cache/MassifCache";
import {Analytics} from "@analytics/Analytics";
import type {ContentTypes} from "@app-types";
import type {BulletinMetadata, BulletinProvider} from "./types";

const meteoFranceHeaders: AxiosHeaders = new AxiosHeaders();
meteoFranceHeaders.set('Content-Type', 'application/xml');
meteoFranceHeaders.set('apikey', METEOFRANCE_TOKEN);

export class MeteoFranceProvider implements BulletinProvider {
    readonly id = 'meteofrance';
    readonly deliveryMode = 'pdf' as const;

    async fetchBulletinMetadata(regionCode: string): Promise<BulletinMetadata | undefined> {
        try {
            const response = await axios.get(
                `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${regionCode}&format=xml`,
                {headers: meteoFranceHeaders, timeout: 10000}
            );

            const xml = response.data as string;

            // Core dates — still use regex for reliability (XML structure varies)
            const matchFrom = xml.match(/DATEBULLETIN="(.[0-9-T:]*)"/);
            const matchUntil = xml.match(/DATEVALIDITE="(.[0-9-T:]*)"/);

            if (matchFrom == null || matchUntil == null) {
                return undefined;
            }

            const matchRiskLevel = xml.match(/RISQUEMAXI="(\d+)"/);
            const riskLevel = matchRiskLevel ? parseInt(matchRiskLevel[1], 10) : undefined;

            // Enhanced metadata via XML parser (best-effort, won't fail the whole call)
            let freezingLevel: number | undefined;
            let snowStability: string | undefined;
            let snowQuality: string | undefined;
            let windDescription: string | undefined;
            let precipitationForecast: string | undefined;

            try {
                const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@_'});
                const parsed = parser.parse(xml);

                // Navigate the BRA XML structure
                const bra = parsed?.BULLETINS_NEIGE_AVALANCHE?.BRA;
                if (bra) {
                    // Freezing level (isotherme 0°C)
                    const matchIso = xml.match(/ISOTHERME_0="(-?\d+)"/);
                    if (matchIso) {
                        freezingLevel = parseInt(matchIso[1], 10);
                    }

                    // Snow stability text
                    const stabilite = bra.STABILITE?.TEXTE;
                    if (typeof stabilite === 'string' && stabilite.trim()) {
                        snowStability = stabilite.trim();
                    }

                    // Snow quality description
                    const qualite = bra.QUALITE?.TEXTE;
                    if (typeof qualite === 'string' && qualite.trim()) {
                        snowQuality = qualite.trim();
                    }

                    // Wind description
                    const vent = bra.METEO?.COMMENTAIRE;
                    if (typeof vent === 'string' && vent.trim()) {
                        windDescription = vent.trim();
                    }

                    // Precipitation / weather forecast text
                    const meteoTexte = bra.METEO?.TEXTE;
                    if (typeof meteoTexte === 'string' && meteoTexte.trim()) {
                        precipitationForecast = meteoTexte.trim();
                    }
                }
            } catch (parseError) {
                console.warn(`Enhanced XML parsing failed for ${regionCode}, continuing with basic metadata:`, parseError);
            }

            return {
                validFrom: new Date(matchFrom[1]),
                validTo: new Date(matchUntil[1]),
                riskLevel,
                freezingLevel,
                snowStability,
                snowQuality,
                windDescription,
                precipitationForecast,
            };
        } catch (error) {
            const massifName = MassifCache.findByCode(regionCode)?.name || `massif ${regionCode}`;
            console.error(`Failed to fetch bulletin metadata for ${massifName}:`, error);

            await Analytics.sendError(
                error as Error,
                `MeteoFranceProvider.fetchBulletinMetadata: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    async fetchBulletin(regionCode: string, filename: string): Promise<string | null> {
        const resp = await fetch(
            `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${regionCode}&format=pdf`,
            {headers: meteoFranceHeaders}
        );

        if (resp.ok && resp.body) {
            console.log("Writing to file:", filename);
            const writer = createWriteStream(filename);
            // @ts-ignore
            Readable.fromWeb(resp.body).pipe(writer);
            await new Promise<void>((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', reject);
            });
            console.log("Saved");
            return filename;
        } else {
            console.log("Failed");
            return null;
        }
    }

    getAvailableContentTypes(): Array<keyof ContentTypes> {
        return ['bulletin', 'snow_report', 'fresh_snow', 'weather', 'last_7_days', 'rose_pentes', 'montagne_risques'];
    }
}
