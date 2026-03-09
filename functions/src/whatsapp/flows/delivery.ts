import {Bulletin, ContentTypes, Massif} from "@app-types";
import {ImageService} from "@services/imageService";
import {WhatsAppClient} from "@whatsapp/client";
import {formatError} from "@utils/formatters";
import {Analytics} from "@analytics/Analytics";
import {createPromiseCache} from "@utils/cache";
import type {TemplateComponent} from "@whatsapp/types";
import type {WhatsAppReportFields} from "@services/reportService";

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
    return `${massif.name} • ${day}${suffix} ${month}${risk}`;
}

/** Send a bulletin PDF via the 'bulletin' message template. */
export async function sendBulletinTemplate(to: string, bulletin: Bulletin, massif: Massif): Promise<void> {
    const components: TemplateComponent[] = [
        {
            type: 'header',
            parameters: [{
                type: 'document',
                document: {link: bulletin.public_url, filename: bulletin.filename.replace(/^\/tmp\//, '')},
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
        {
            type: 'button',
            sub_type: 'quick_reply',
            index: 0,
            parameters: [{
                type: 'payload',
                payload: `unsub:${massif.code}`,
            }],
        },
    ];
    console.log(`[sendBulletinTemplate] payload=${JSON.stringify({to, template: 'bulletin', lang: 'en', components})}`);
    await WhatsAppClient.sendTemplate(to, 'bulletin', 'en', components);
}

/**
 * Send a conditions report via the 'conditions_report' template.
 * Falls back to the 'bulletin' template if the report template isn't approved yet.
 *
 * Template body:
 *   *Conditions report for {{massif_name}}*
 *   📅 {{date}}
 *   ⚠️ *Avalanche Risk*  {{risk}}
 *   🌡️ *Weather*  {{weather}}
 *   ❄️ *Best snow*  {{snow}}
 *   ⭐ *Tip*  {{tip}}
 *   _Check being for going out_
 *
 * Buttons:
 *   [0] Quick reply: "Suggest routes" (payload: routes:<massif_code>)
 *   [1] Quick reply: "Unsubscribe" (payload: unsub:<massif_code>)
 */
export async function sendReportTemplate(
    to: string,
    bulletin: Bulletin,
    massif: Massif,
    fields: WhatsAppReportFields,
): Promise<void> {
    const day = bulletin.valid_to.getUTCDate();
    const suffix = ordinalSuffix(day);
    const month = bulletin.valid_to.toLocaleString('en-GB', {month: 'long', timeZone: 'UTC'});

    const components: TemplateComponent[] = [
        {
            type: 'header',
            parameters: [{
                type: 'document',
                document: {link: bulletin.public_url, filename: bulletin.filename.replace(/^\/tmp\//, '')},
            }],
        },
        {
            type: 'body',
            parameters: [
                {type: 'text', parameter_name: 'massif_name', text: massif.name},
                {type: 'text', parameter_name: 'date', text: `${day}${suffix} ${month}`},
                {type: 'text', parameter_name: 'risk', text: fields.risk},
                {type: 'text', parameter_name: 'weather', text: fields.weather},
                {type: 'text', parameter_name: 'snow', text: fields.snow},
                {type: 'text', parameter_name: 'tip', text: fields.tip},
            ],
        },
        {
            type: 'button',
            sub_type: 'quick_reply',
            index: 0,
            parameters: [{
                type: 'payload',
                payload: `routes:${massif.code}`,
            }],
        },
        {
            type: 'button',
            sub_type: 'quick_reply',
            index: 1,
            parameters: [{
                type: 'payload',
                payload: `unsub:${massif.code}`,
            }],
        },
    ];

    try {
        console.log(`[sendReportTemplate] Sending conditions_report template to ${to}`);
        await WhatsAppClient.sendTemplate(to, 'conditions_report', 'en', components);
    } catch (error) {
        // Template may not be approved yet — fall back to bulletin template
        console.warn(`[sendReportTemplate] conditions_report template failed, falling back to bulletin template: ${formatError(error)}`);
        await sendBulletinTemplate(to, bulletin, massif);
    }
}

export namespace WhatsAppDelivery {

    const mediaIdCache = createPromiseCache<string>();

    export function clearMediaCache(): void {
        mediaIdCache.clear();
    }

    function getOrUploadMedia(image: ImageService.FetchedImage): Promise<string> {
        return mediaIdCache.getOrCreate(image.filename, () =>
            WhatsAppClient.uploadMedia(image.data, 'image/png', image.filename)
        );
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
                console.error(`Failed to send bulletin PDF for ${massif.name}: ${formatError(error)}`);
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
            console.error(`Failed to fetch images for ${massif.name}: ${formatError(error)}`);
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
                console.error(`Failed to send image ${image.filename} for ${massif.name}: ${formatError(error)}`);
                // Continue sending remaining images
            }
        }
    }
}
