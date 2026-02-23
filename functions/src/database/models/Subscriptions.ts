import type {Massif, ContentTypes, Subscription, Platform} from "@app-types";
import {getClient} from "@config/database";

export namespace Subscriptions {

    export async function isKnownUser(recipientId: string, platform: Platform = 'telegram'): Promise<boolean> {
        const client = await getClient();
        const result = await client.query(
            "SELECT 1 FROM recipients WHERE number = $1 AND platform = $2 LIMIT 1",
            [recipientId, platform],
        );
        return result.rows.length > 0;
    }

    export async function isSubscribed(recipientId: string, massifCode: number, platform: Platform = 'telegram'):Promise<boolean>{
        const client = await getClient();
        const result = await client.query(
            "SELECT 1 FROM bra_subscriptions WHERE recipient = $1 AND massif = $2 AND platform = $3 LIMIT 1",
            [recipientId, massifCode, platform]
        );
        return result.rows.length > 0;
    }

    export async function getSubscriptionStatuses(recipientId: string, massifCodes: number[], platform: Platform = 'telegram'): Promise<Map<number, boolean>> {
        if (massifCodes.length === 0) {
            return new Map();
        }

        const client = await getClient();
        const result = await client.query(
            "SELECT massif FROM bra_subscriptions WHERE recipient = $1 AND massif = ANY($2) AND platform = $3",
            [recipientId, massifCodes, platform]
        );

        const subscribedMassifs = new Set(result.rows.map(row => row.get('massif') as number));
        const statusMap = new Map<number, boolean>();

        for (const code of massifCodes) {
            statusMap.set(code, subscribedMassifs.has(code));
        }

        return statusMap;
    }

    export async function getSubscription(recipientId: string, massifCode: number, platform: Platform = 'telegram'): Promise<Subscription | null> {
        const client = await getClient();
        const result = await client.query(
            "SELECT * FROM bra_subscriptions WHERE recipient = $1 AND massif = $2 AND platform = $3 LIMIT 1",
            [recipientId, massifCode, platform]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            recipient: row.get('recipient') as string,
            massif: row.get('massif') as number,
            platform: row.get('platform') as Platform,
            bulletin: row.get('bulletin') as boolean,
            snow_report: row.get('snow_report') as boolean,
            fresh_snow: row.get('fresh_snow') as boolean,
            weather: row.get('weather') as boolean,
            last_7_days: row.get('last_7_days') as boolean,
            rose_pentes: row.get('rose_pentes') as boolean,
            montagne_risques: row.get('montagne_risques') as boolean,
        };
    }

    export async function getAllForUser(recipientId: string, platform: Platform = 'telegram'): Promise<Array<{ massif: number }>> {
        const client = await getClient();
        const result = await client.query(
            "SELECT massif FROM bra_subscriptions WHERE recipient = $1 AND platform = $2",
            [recipientId, platform],
        );
        return result.rows.map(row => ({massif: row.get('massif') as number}));
    }

    export async function subscribe(userId: string, massif: Massif, contentTypes?: Partial<ContentTypes>, platform: Platform = 'telegram'): Promise<void> {
        const client = await getClient();
        await client.query("INSERT INTO recipients (number, platform) VALUES ($1, $2) ON CONFLICT (number, platform) DO NOTHING", [userId, platform]);

        // Default content types if not provided
        const types: ContentTypes = {
            bulletin: contentTypes?.bulletin ?? true,
            snow_report: contentTypes?.snow_report ?? false,
            fresh_snow: contentTypes?.fresh_snow ?? false,
            weather: contentTypes?.weather ?? false,
            last_7_days: contentTypes?.last_7_days ?? false,
            rose_pentes: contentTypes?.rose_pentes ?? false,
            montagne_risques: contentTypes?.montagne_risques ?? false,
        };

        await client.query(
            `INSERT INTO bra_subscriptions (recipient, massif, platform, bulletin, snow_report, fresh_snow, weather, last_7_days, rose_pentes, montagne_risques)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (recipient, massif, platform) DO UPDATE SET
                bulletin = $4,
                snow_report = $5,
                fresh_snow = $6,
                weather = $7,
                last_7_days = $8,
                rose_pentes = $9,
                montagne_risques = $10`,
            [userId, massif.code, platform, types.bulletin, types.snow_report, types.fresh_snow, types.weather, types.last_7_days, types.rose_pentes, types.montagne_risques]
        );
    }

    export async function updateContentTypes(userId: string, massifCode: number, contentTypes: Partial<ContentTypes>, platform: Platform = 'telegram'): Promise<void> {
        const client = await getClient();
        const updates: string[] = [];
        const values: any[] = [userId, massifCode, platform];
        let paramIndex = 4;

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
        if (contentTypes.rose_pentes !== undefined) {
            updates.push(`rose_pentes = $${paramIndex++}`);
            values.push(contentTypes.rose_pentes);
        }
        if (contentTypes.montagne_risques !== undefined) {
            updates.push(`montagne_risques = $${paramIndex++}`);
            values.push(contentTypes.montagne_risques);
        }

        if (updates.length === 0) {
            return;
        }

        await client.query(
            `UPDATE bra_subscriptions SET ${updates.join(', ')} WHERE recipient = $1 AND massif = $2 AND platform = $3`,
            values
        );
    }

    export async function unsubscribe(userId: string, massif: Massif, platform: Platform = 'telegram'): Promise<void> {
        const client = await getClient();
        await client.query("DELETE FROM bra_subscriptions WHERE recipient = $1 AND massif = $2 AND platform = $3", [userId, massif.code, platform]);
    }

    export async function unsubscribeAll(userId: string, platform: Platform = 'telegram'): Promise<void> {
        const client = await getClient();
        await client.query("DELETE FROM bra_subscriptions WHERE recipient = $1 AND platform = $2", [userId, platform]);
    }

}