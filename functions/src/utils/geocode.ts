import axios from "axios";
import {GOOGLE_MAPS_API_KEY} from "@config/envs";

interface GeocodeResult {
    lat: number;
    lng: number;
    formattedAddress: string;
}

/**
 * Geocode a place name to coordinates using Google Maps Geocoding API.
 * Biased towards France to improve relevance for French mountain locations.
 * Returns null if no results found or on error.
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
    try {
        const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
            params: {
                address: query,
                region: "fr",
                language: "fr",
                key: GOOGLE_MAPS_API_KEY,
            },
            timeout: 15000,
        });

        if (response.data.status !== "OK" || !response.data.results?.length) {
            return null;
        }

        const location = response.data.results[0].geometry.location;
        return {
            lat: location.lat,
            lng: location.lng,
            formattedAddress: response.data.results[0].formatted_address,
        };
    } catch (error) {
        console.error("Geocoding failed:", error);
        return null;
    }
}
