import { bot } from "@config/telegram";
import {Bulletin, BulletinDestination} from "@app-types";
import {Database} from "@database/queries";

export async function generateSubscriptionDestinations(bulletins: Bulletin[]): Promise<BulletinDestination[]> {
    const rows = await Database.getSubscriptionsByMassif();
    const destinations: BulletinDestination[] = [];

    for (const row of rows) {
        const bulletin = bulletins.find(value => value.massif == row.massif);
        if (bulletin != undefined) {
            destinations.push({
                recipients: row.recipients.split(","),
                massif: row.massif,
                filename: bulletin.filename,
                public_url: bulletin.public_url
            });
        }
    }

    return destinations;
}

export async function send(destinations: BulletinDestination[]) {
    for (const destination of destinations) {
        for (const recipient of destination.recipients) {
            await bot.api.sendDocument(recipient, destination.public_url);
        }
    }
}
