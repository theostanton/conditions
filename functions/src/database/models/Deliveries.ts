import {getClient} from "@config/database";
import {Bulletin, Massif} from "@app-types";

export namespace Deliveries {

    type PartialBulletin = Pick<Bulletin, 'massif' | 'valid_from'>

    export async function hasBeenDelivered(recipient: string, bulletin: PartialBulletin): Promise<boolean> {
        const client = await getClient();
        const result = await client.query<{ count: string }>(
            "SELECT COUNT(*) as count FROM deliveries_bras WHERE recipient = $1 AND massif = $2 AND valid_from = $3",
            [recipient, bulletin.massif, bulletin.valid_from]
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

        const client = await getClient();
        const result = await client.query<{ recipient: string }>(
            "SELECT recipient FROM deliveries_bras WHERE recipient = ANY($1) AND massif = $2 AND valid_from = $3",
            [recipients, bulletin.massif, bulletin.valid_from]
        );

        const deliveredSet = new Set([...result].map(row => row.recipient));
        return recipients.filter(recipient => !deliveredSet.has(recipient));
    }

    export async function recordDelivery(recipient: string, bulletin: PartialBulletin): Promise<void> {
        const client = await getClient();
        await client.query(
            "INSERT INTO deliveries_bras (recipient, massif, valid_from, delivery_timestamp) VALUES ($1, $2, $3, NOW())",
            [recipient, bulletin.massif, bulletin.valid_from, new Date()]
        );
    }
}
