import {Bulletin, ContentTypes, Massif} from "@app-types";
import {ImageService} from "@services/imageService";
import {WhatsAppClient} from "@whatsapp/client";
import {Analytics} from "@analytics/Analytics";
import type {TemplateComponent} from "@whatsapp/types";

function ordinalSuffix(n: number): string {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Produces e.g. "for Mont-Blanc • 26th Feb • 3 " so the template renders
// "Avalanche bulletin for Mont-Blanc • 26th Feb • 3 / 5"
function templateBodyParam(bulletin: Bulletin, massif: Massif): string {
    const day = bulletin.valid_to.getUTCDate();
    const suffix = ordinalSuffix(day);
    const month = bulletin.valid_to.toLocaleString('en-GB', {month: 'short', timeZone: 'UTC'});
    const risk = bulletin.risk_level != null ? ` • ${bulletin.risk_level} ` : '';
    return `for ${massif.name} • ${day}${suffix} ${month}${risk}`;
}

/** Send a bulletin PDF via the 'bulletin' message template. */
export async function sendBulletinTemplate(to: string, bulletin: Bulletin, massif: Massif): Promise<void> {
    const components: TemplateComponent[] = [
        {
            type: 'header',
            parameters: [{
                type: 'document',
                document: {link: bulletin.public_url, filename: bulletin.filename},
            }],
        },
        {
            type: 'body',
            parameters: [{
                type: 'text',
                parameter_name: 'text',
                text: templateBodyParam(bulletin, massif),
            }],
        },
    ];
    console.log(`[sendBulletinTemplate] payload=${JSON.stringify({to, template: 'bulletin', lang: 'en', components})}`);
    await WhatsAppClient.sendTemplate(to, 'bulletin', 'en', components);
}

export namespace WhatsAppDelivery {

    // Cache uploaded media IDs to avoid re-uploading the same image buffer
    // for every recipient during a cron run. Keyed by image filename.
    const mediaIdCache = new Map<string, Promise<string>>();

    export function clearMediaCache(): void {
        mediaIdCache.clear();
    }

    function getOrUploadMedia(image: ImageService.FetchedImage): Promise<string> {
        const cached = mediaIdCache.get(image.filename);
        if (cached) return cached;

        const promise = WhatsAppClient.uploadMedia(image.data, 'image/png', image.filename);
        mediaIdCache.set(image.filename, promise);

        // Remove from cache on failure so retries can re-upload
        promise.catch(() => mediaIdCache.delete(image.filename));

        return promise;
    }

    export async function sendBulletinWithContent(
        to: string,
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>,
    ): Promise<void> {
        // Send bulletin PDF via template message (required to reach users outside the 24h window)
        if (contentTypes.bulletin !== false) {
            try {
                await sendBulletinTemplate(to, bulletin, massif);
            } catch (error) {
                console.error(`Failed to send bulletin PDF for ${massif.name}:`, error);
                await Analytics.sendError(
                    error as Error,
                    `WhatsAppDelivery: Failed to send bulletin PDF for ${massif.name}`
                ).catch(err => console.error('Failed to send error analytics:', err));
                throw error;
            }
        }

        // Fetch and send images for enabled content types
        let fetchedImages: ImageService.FetchedImage[] = [];
        try {
            fetchedImages = await ImageService.fetchImages(massif.code, contentTypes, bulletin);
        } catch (error) {
            console.error(`Failed to fetch images for ${massif.name}:`, error);
            await Analytics.sendError(
                error as Error,
                `WhatsAppDelivery: Failed to fetch images for ${massif.name}`
            ).catch(err => console.error('Failed to send error analytics:', err));
            // Don't throw - allow partial delivery (bulletin was sent successfully)
        }

        // Send images individually (WhatsApp has no media group concept)
        for (const image of fetchedImages) {
            try {
                const mediaId = await getOrUploadMedia(image);
                await WhatsAppClient.sendImage(to, {id: mediaId}, image.caption);
            } catch (error) {
                console.error(`Failed to send image ${image.filename} for ${massif.name}:`, error);
                // Continue sending remaining images
            }
        }
    }
}
