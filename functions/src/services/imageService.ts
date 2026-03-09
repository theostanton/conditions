import {METEOFRANCE_TOKEN} from "@config/envs";
import {Bulletin, ContentTypes} from "@app-types";
import {CONTENT_TYPE_CONFIGS, getImageContentTypes, ContentTypeKey} from "@constants/contentTypes";
import axios, {AxiosHeaders} from "axios";
import {MassifCache} from "@cache/MassifCache";
import {formatError} from "@utils/formatters";
import {Analytics} from "@analytics/Analytics";
import {createPromiseCache} from "@utils/cache";

const meteoFranceHeaders: AxiosHeaders = new AxiosHeaders();
meteoFranceHeaders.set('apikey', METEOFRANCE_TOKEN);

export namespace ImageService {

    export type ImageType = Exclude<ContentTypeKey, 'bulletin'>;

    const imageCache = createPromiseCache<FetchedImage>();

    /**
     * Clear the image cache. Call at the start of each cron run.
     */
    export function clearCache(): void {
        imageCache.clear();
    }

    /**
     * Format date as "Sat 12th March"
     */
    function formatDate(date: Date): string {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'March', 'April', 'May', 'June',
            'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[date.getDay()];
        const day = date.getDate();
        const month = months[date.getMonth()];

        // Add ordinal suffix (st, nd, rd, th)
        let suffix = 'th';
        if (day % 10 === 1 && day !== 11) suffix = 'st';
        else if (day % 10 === 2 && day !== 12) suffix = 'nd';
        else if (day % 10 === 3 && day !== 13) suffix = 'rd';

        return `${dayName} ${day}${suffix} ${month}`;
    }

    /**
     * Generate caption for an image type with bulletin date
     */
    function generateCaption(imageType: ImageType, bulletin: Bulletin): string {
        const config = CONTENT_TYPE_CONFIGS.find(c => c.key === imageType);
        const label = config ? `${config.emoji} ${config.label}` : imageType;
        const datedContentTypeKeys: ContentTypeKey[] = ["rose_pentes", "montagne_risques", "weather"]
        const name = MassifCache.findByCode(bulletin.massif)?.name
        if (!name) {
            return label
        }
        if (datedContentTypeKeys.includes(imageType)) {
            const formattedDate = formatDate(bulletin.valid_to);
            return `${label} • ${name} • ${formattedDate}`;
        } else {
            return `${label} • ${name}`
        }
    }

    export interface FetchedImage {
        data: Buffer;
        type: ImageType;
        filename: string;
        caption: string;
    }

    /**
     * Get image types to fetch based on enabled content types
     */
    export function getImageTypesFromContentTypes(contentTypes: Partial<ContentTypes>): ImageType[] {
        const imageConfigs = getImageContentTypes();
        return imageConfigs
            .filter(config => contentTypes[config.key])
            .map(config => config.key as ImageType);
    }

    /**
     * Build URL for a specific image type and massif
     */
    function buildImageUrl(massifCode: string, imageType: ImageType): string {
        const config = CONTENT_TYPE_CONFIGS.find(c => c.key === imageType);
        if (!config || !config.endpoint) {
            throw new Error(`No endpoint configured for image type: ${imageType}`);
        }
        return `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/image/${config.endpoint}?id-massif=${massifCode}`;
    }

    /**
     * Fetch a single image, using the in-memory cache to avoid duplicate
     * Météo-France API calls within the same cron run.
     */
    export function fetchImage(massifCode: string, imageType: ImageType, bulletin: Bulletin): Promise<FetchedImage> {
        const cacheKey = `${massifCode}:${imageType}`;
        return imageCache.getOrCreate(cacheKey, () => fetchImageFromApi(massifCode, imageType, bulletin));
    }

    async function fetchImageFromApi(massifCode: string, imageType: ImageType, bulletin: Bulletin): Promise<FetchedImage> {
        const url = buildImageUrl(massifCode, imageType);

        try {
            const response = await axios.get(url, {
                headers: meteoFranceHeaders,
                responseType: 'arraybuffer'
            });

            const data = Buffer.from(response.data);
            const config = CONTENT_TYPE_CONFIGS.find(c => c.key === imageType);
            const endpoint = config?.endpoint || imageType;
            const filename = `${endpoint}-${massifCode}.jpg`;
            const caption = generateCaption(imageType, bulletin);

            return {data, type: imageType, filename, caption};
        } catch (error) {
            const massifName = MassifCache.findByCode(massifCode)?.name || `massif ${massifCode}`;
            const errorContext = `Failed to fetch ${imageType} image for ${massifName}`;
            console.error(`${errorContext}: ${formatError(error)}`);

            // Report to admin
            await Analytics.sendError(
                error as Error,
                `imageService.fetchImage: ${imageType} for ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    /**
     * Fetch all requested images based on content types
     */
    export async function fetchImages(massifCode: string, contentTypes: Partial<ContentTypes>, bulletin: Bulletin): Promise<FetchedImage[]> {
        const imageTypes = getImageTypesFromContentTypes(contentTypes);

        // Fetch all images in parallel
        const imagePromises = imageTypes.map(type => fetchImage(massifCode, type, bulletin));

        // Use allSettled to handle partial failures gracefully
        const results = await Promise.allSettled(imagePromises);

        // Filter out failed requests and log them
        const fetchedImages: FetchedImage[] = [];
        const failedTypes: ImageType[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
                fetchedImages.push(result.value);
            } else {
                const imageType = imageTypes[i];
                failedTypes.push(imageType);
                console.error(`Failed to fetch ${imageType} image: ${formatError(result.reason)}`);
            }
        }

        // Report partial failures to admin if any occurred
        if (failedTypes.length > 0) {
            const massifName = MassifCache.findByCode(massifCode)?.name || `massif ${massifCode}`;
            const failedTypesList = failedTypes.join(', ');
            const summary = `${failedTypes.length}/${imageTypes.length} image(s) failed for ${massifName}: ${failedTypesList}`;

            await Analytics.send(
                `🚨 Partial image fetch failure\n\n${summary}`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        return fetchedImages;
    }
}
