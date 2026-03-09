import {ContentTypes} from "@app-types";

export type ContentTypeKey = keyof ContentTypes;

export interface ContentTypeConfig {
    key: ContentTypeKey;
    label: string;
    emoji: string;
    endpoint: string;
}

/**
 * Centralized content type configuration
 * This is the single source of truth for content type labels, emojis, and API endpoints
 */
export const CONTENT_TYPE_CONFIGS: ContentTypeConfig[] = [
    {
        key: 'bulletin',
        label: 'Bulletin',
        emoji: '📄',
        endpoint: '' // Bulletin is a PDF, not an image endpoint
    },
    {
        key: 'snow_report',
        label: 'Snow Report',
        emoji: '❄️',
        endpoint: 'montagne-enneigement'
    },
    {
        key: 'fresh_snow',
        label: 'Fresh Snow',
        emoji: '🌨️',
        endpoint: 'graphe-neige-fraiche'
    },
    {
        key: 'weather',
        label: 'Weather',
        emoji: '🌤️',
        endpoint: 'apercu-meteo'
    },
    {
        key: 'last_7_days',
        label: 'Last 7 Days',
        emoji: '📊',
        endpoint: 'sept-derniers-jours'
    },
    {
        key: 'rose_pentes',
        label: 'Aspect Rose',
        emoji: '⭐️',
        endpoint: 'rose-pentes'
    },
    {
        key: 'montagne_risques',
        label: 'Mountain Risks',
        emoji: '⚠️',
        endpoint: 'montagne-risques'
    },
    // conditions_report temporarily hidden — not ready for production
    // {
    //     key: 'conditions_report',
    //     label: 'Conditions Report',
    //     emoji: '🏔',
    //     endpoint: ''
    // }
];

/**
 * Get config for a specific content type
 */
export function getContentTypeConfig(key: ContentTypeKey): ContentTypeConfig | undefined {
    return CONTENT_TYPE_CONFIGS.find(config => config.key === key);
}

/**
 * Get display label with emoji for a content type
 */
export function getContentTypeLabel(key: ContentTypeKey): string {
    const config = getContentTypeConfig(key);
    return config ? `${config.emoji} ${config.label}` : key;
}

/**
 * Get all image-based content types (excluding bulletin which is a PDF)
 */
export function getImageContentTypes(): ContentTypeConfig[] {
    return CONTENT_TYPE_CONFIGS.filter(config => config.endpoint !== '');
}
