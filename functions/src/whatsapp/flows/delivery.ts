import {Bulletin, ContentTypes, Massif} from "@app-types";
import {ImageService} from "@services/imageService";
import {WhatsAppClient} from "@whatsapp/client";
import {Analytics} from "@analytics/Analytics";

export namespace WhatsAppDelivery {

    export async function sendBulletinWithContent(
        to: string,
        bulletin: Bulletin,
        massif: Massif,
        contentTypes: Partial<ContentTypes>,
    ): Promise<void> {
        // Send bulletin PDF if enabled
        if (contentTypes.bulletin !== false) {
            try {
                await WhatsAppClient.sendDocument(
                    to,
                    bulletin.public_url,
                    `Avalanche bulletin for ${massif.name}`,
                    bulletin.filename,
                );
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
                const mediaId = await WhatsAppClient.uploadMedia(image.data, 'image/png', image.filename);
                await WhatsAppClient.sendImage(to, {id: mediaId}, image.caption);
            } catch (error) {
                console.error(`Failed to send image ${image.filename} for ${massif.name}:`, error);
                // Continue sending remaining images
            }
        }
    }
}
