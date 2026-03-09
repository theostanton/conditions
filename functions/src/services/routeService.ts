import axios from "axios";
import {MassifCache} from "@cache/MassifCache";
import {getCentroid} from "@utils/geo";
import {Analytics} from "@analytics/Analytics";
import type {GeoJSONGeometry} from "@app-types";

const C2C_API_BASE = "https://api.camptocamp.org";

export type RouteInfo = {
    id: number;
    name: string;
    difficulty: string;
    elevationMin?: number;
    elevationMax?: number;
    aspects?: string[];
    url: string;
};

// In-memory cache per cron run
const routeCache = new Map<string, Promise<RouteInfo[]>>();

export namespace RouteService {

    export function clearCache(): void {
        routeCache.clear();
    }

    export async function fetchRoutesForMassif(massifCode: string): Promise<RouteInfo[]> {
        const cached = routeCache.get(massifCode);
        if (cached) return cached;

        const promise = fetchFromApi(massifCode);
        routeCache.set(massifCode, promise);

        promise.catch(() => routeCache.delete(massifCode));

        return promise;
    }

    async function fetchFromApi(massifCode: string): Promise<RouteInfo[]> {
        const massif = MassifCache.findByCode(massifCode);
        if (!massif?.geometry) {
            throw new Error(`No geometry for massif ${massifCode}`);
        }

        try {
            const bbox = computeBbox(massif.geometry);

            const response = await axios.get(`${C2C_API_BASE}/routes`, {
                params: {
                    act: "skitouring",
                    bbox: bbox.join(","),
                    limit: 15,
                    pl: "en",
                },
                timeout: 15000,
            });

            const documents = response.data?.documents || response.data?.routes || [];

            return documents
                .map((doc: any) => parseRoute(doc))
                .filter((r: RouteInfo | null): r is RouteInfo => r !== null)
                .slice(0, 10);
        } catch (error) {
            const massifName = massif?.name || `massif ${massifCode}`;
            console.error(`Failed to fetch routes for ${massifName}:`, error);

            await Analytics.sendError(
                error as Error,
                `RouteService.fetchRoutesForMassif: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    function parseRoute(doc: any): RouteInfo | null {
        const id = doc.document_id;
        if (!id) return null;

        // Extract localized title
        const locale = doc.locales?.[0] || {};
        const name = locale.title || locale.title_prefix || `Route ${id}`;

        // Ski touring difficulty rating
        const difficulty = doc.ski_rating || doc.global_rating || "";

        // Elevation
        const elevationMin = doc.elevation_min ?? undefined;
        const elevationMax = doc.elevation_max ?? undefined;

        // Orientations/aspects
        const aspects: string[] = [];
        if (doc.orientations) {
            if (Array.isArray(doc.orientations)) {
                aspects.push(...doc.orientations);
            }
        }

        return {
            id,
            name,
            difficulty,
            elevationMin,
            elevationMax,
            aspects: aspects.length > 0 ? aspects : undefined,
            url: `https://www.camptocamp.org/routes/${id}`,
        };
    }

    /**
     * Compute a Web Mercator-style bounding box from GeoJSON geometry.
     * CampToCamp API expects bbox in EPSG:3857 (Web Mercator) coordinates.
     */
    function computeBbox(geometry: GeoJSONGeometry): [number, number, number, number] {
        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        const processRing = (ring: number[][]) => {
            for (const [lng, lat] of ring) {
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            }
        };

        if (geometry.type === 'Polygon') {
            processRing(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            for (const polygon of geometry.coordinates) {
                processRing(polygon[0]);
            }
        }

        // Convert to EPSG:3857 (Web Mercator)
        return [
            lngToMercatorX(minLng),
            latToMercatorY(minLat),
            lngToMercatorX(maxLng),
            latToMercatorY(maxLat),
        ];
    }

    function lngToMercatorX(lng: number): number {
        return (lng * 20037508.34) / 180;
    }

    function latToMercatorY(lat: number): number {
        const rad = (lat * Math.PI) / 180;
        const y = Math.log(Math.tan(Math.PI / 4 + rad / 2));
        return (y * 20037508.34) / Math.PI;
    }
}
