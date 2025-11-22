import type {Massif, ContentTypes, Subscription} from "@app-types";
import {getClient} from "@config/database";

export namespace Subscriptions {

    export async function isSubscribed(recipientId: number, massifCode: number):Promise<boolean>{
        const client = await getClient();
        const result = await client.query(
            "SELECT 1 FROM bra_subscriptions WHERE recipient = $1 AND massif = $2 LIMIT 1",
            [recipientId, massifCode]
        );
        return result.rows.length > 0;
    }

    export async function getSubscriptionStatuses(recipientId: number, massifCodes: number[]): Promise<Map<number, boolean>> {
        if (massifCodes.length === 0) {
            return new Map();
        }

        const client = await getClient();
        const result = await client.query(
            "SELECT massif FROM bra_subscriptions WHERE recipient = $1 AND massif = ANY($2)",
            [recipientId, massifCodes]
        );

        const subscribedMassifs = new Set(result.rows.map(row => row.get('massif') as number));
        const statusMap = new Map<number, boolean>();

        for (const code of massifCodes) {
            statusMap.set(code, subscribedMassifs.has(code));
        }

        return statusMap;
    }

    export async function getSubscription(recipientId: number, massifCode: number): Promise<Subscription | null> {
        const client = await getClient();
        const result = await client.query(
            "SELECT * FROM bra_subscriptions WHERE recipient = $1 AND massif = $2 LIMIT 1",
            [recipientId, massifCode]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            recipient: row.get('recipient') as number,
            massif: row.get('massif') as number,
            bulletin: row.get('bulletin') as boolean,
            snow_report: row.get('snow_report') as boolean,
            fresh_snow: row.get('fresh_snow') as boolean,
            weather: row.get('weather') as boolean,
            last_7_days: row.get('last_7_days') as boolean,
        };
    }

    export async function subscribe(userId: number, massif: Massif, contentTypes?: Partial<ContentTypes>): Promise<void> {
        const client = await getClient();
        await client.query("INSERT INTO recipients (number) VALUES ($1) on conflict(number) DO NOTHING", [userId]);

        // Default content types if not provided
        const types: ContentTypes = {
            bulletin: contentTypes?.bulletin ?? true,
            snow_report: contentTypes?.snow_report ?? false,
            fresh_snow: contentTypes?.fresh_snow ?? false,
            weather: contentTypes?.weather ?? false,
            last_7_days: contentTypes?.last_7_days ?? false,
        };

        await client.query(
            `INSERT INTO bra_subscriptions (recipient, massif, bulletin, snow_report, fresh_snow, weather, last_7_days)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (recipient, massif) DO UPDATE SET
                bulletin = $3,
                snow_report = $4,
                fresh_snow = $5,
                weather = $6,
                last_7_days = $7`,
            [userId, massif.code, types.bulletin, types.snow_report, types.fresh_snow, types.weather, types.last_7_days]
        );
    }

    export async function updateContentTypes(userId: number, massifCode: number, contentTypes: Partial<ContentTypes>): Promise<void> {
        const client = await getClient();
        const updates: string[] = [];
        const values: any[] = [userId, massifCode];
        let paramIndex = 3;

        if (contentTypes.bulletin !== undefined) {
            updates.push(`bulletin = $${paramIndex++}`);
            values.push(contentTypes.bulletin);
        }
        if (contentTypes.snow_report !== undefined) {
            updates.push(`snow_report = $${paramIndex++}`);
            values.push(contentTypes.snow_report);
        }
        if (contentTypes.fresh_snow !== undefined) {
            updates.push(`fresh_snow = $${paramIndex++}`);
            values.push(contentTypes.fresh_snow);
        }
        if (contentTypes.weather !== undefined) {
            updates.push(`weather = $${paramIndex++}`);
            values.push(contentTypes.weather);
        }
        if (contentTypes.last_7_days !== undefined) {
            updates.push(`last_7_days = $${paramIndex++}`);
            values.push(contentTypes.last_7_days);
        }

        if (updates.length === 0) {
            return;
        }

        await client.query(
            `UPDATE bra_subscriptions SET ${updates.join(', ')} WHERE recipient = $1 AND massif = $2`,
            values
        );
    }

    export async function unsubscribe(userId: number, massif: Massif): Promise<void> {
        const client = await getClient();
        await client.query("DELETE FROM bra_subscriptions WHERE recipient = $1 AND massif = $2", [userId, massif.code]);
    }

    export async function unsubscribeAll(userId: number): Promise<void> {
        const client = await getClient();
        await client.query("DELETE FROM bra_subscriptions WHERE recipient = $1", [userId]);
    }

}