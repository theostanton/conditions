import {METEOFRANCE_TOKEN} from "@config/envs";
import {ContentTypes} from "@app-types";
import {AxiosHeaders} from "axios";

const meteoFranceHeaders: AxiosHeaders = new AxiosHeaders();
meteoFranceHeaders.set('apikey', METEOFRANCE_TOKEN);

export namespace ImageService {

    export type ImageType = 'snow_report' | 'fresh_snow' | 'weather' | 'last_7_days';

    const IMAGE_ENDPOINT_MAP: Record<ImageType, string> = {
        snow_report: 'montagne-enneigement',
        fresh_snow: 'graphe-neige-fraiche',
        weather: 'apercu-meteo',
        last_7_days: 'sept-derniers-jours'
    };

    /**
     * Get image types to fetch based on enabled content types
     */
    export function getImageTypesFromContentTypes(contentTypes: Partial<ContentTypes>): ImageType[] {
        const imageTypes: ImageType[] = [];

        if (contentTypes.snow_report) {
            imageTypes.push('snow_report');
        }
        if (contentTypes.fresh_snow) {
            imageTypes.push('fresh_snow');
        }
        if (contentTypes.weather) {
            imageTypes.push('weather');
        }
        if (contentTypes.last_7_days) {
            imageTypes.push('last_7_days');
        }

        return imageTypes;
    }

    /**
     * Build URL for a specific image type and massif
     */
    export function buildImageUrl(massifCode: number, imageType: ImageType): string {
        const endpoint = IMAGE_ENDPOINT_MAP[imageType];
        return `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/image/${endpoint}?id-massif=${massifCode}`;
    }

    /**
     * Build URLs for all requested image types
     */
    export function buildImageUrls(massifCode: number, contentTypes: Partial<ContentTypes>): string[] {
        const imageTypes = getImageTypesFromContentTypes(contentTypes);
        return imageTypes.map(type => buildImageUrl(massifCode, type));
    }
}
