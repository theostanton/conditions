import {getClient} from "@config/database";
import {Bulletin, Massif} from "@app-types";

export namespace Deliveries {

    type PartialBulletin = Pick<Bulletin, 'massif' | 'valid_from'>

    export function extractTimestamp(bulletin: PartialBulletin): number {
        return bulletin.valid_from.getTime()
    }

    export async function hasBeenDelivered(recipient: string, bulletin: PartialBulletin): Promise<boolean> {
        const client = getClient();
        const result = await client.query<{ count: string }>(
            "SELECT COUNT(*) as count FROM deliveries_bras WHERE recipient = $1 AND massif = $2 AND date = $3",
            [recipient, bulletin.massif, extractTimestamp(bulletin)]
        );
        const count = parseInt([...result][0]?.count || '0', 10);
        return count > 0;
    }

    /**
     * Batch check which recipients have NOT received a specific bulletin
     * Returns array of recipient IDs who have not yet received the bulletin
     */
    export async function getUndeliveredRecipients(recipients: string[], bulletin: PartialBulletin): Promise<string[]> {
        if (recipients.length === 0) {
            return [];
        }

        const client = getClient();
        const result = await client.query<{ recipient: string }>(
            "SELECT recipient FROM deliveries_bras WHERE recipient = ANY($1) AND massif = $2 AND date = $3",
            [recipients, bulletin.massif, extractTimestamp(bulletin)]
        );

        const deliveredSet = new Set([...result].map(row => row.recipient));
        return recipients.filter(recipient => !deliveredSet.has(recipient));
    }

    export async function recordDelivery(recipient: string, bulletin: PartialBulletin): Promise<void> {
        const client = getClient();
        await client.query(
            "INSERT INTO deliveries_bras (recipient, massif, date, timestamp) VALUES ($1, $2, $3, NOW())",
            [recipient, bulletin.massif, extractTimestamp(bulletin)]
        );
    }
}
