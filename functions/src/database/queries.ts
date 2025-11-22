import {getClient} from "@config/database";
import {BulletinInfos, Subscription} from "@app-types";
import {Analytics} from "@analytics/Analytics";

type SubscriptionRow = {
    massif: number,
    recipients: string
}

export namespace Database {
    export async function getMassifsWithSubscribers(): Promise<number[]> {
        try {
            const client = await getClient();
            const result = await client.query<Pick<BulletinInfos, "massif">>(
                "select concat(massif) as massif from bra_subscriptions group by massif"
            );
            return [...result].map(s => s.massif);
        } catch (error) {
            console.error('Database error in getMassifsWithSubscribers:', error);
            await Analytics.sendError(
                error as Error,
                'Database.getMassifsWithSubscribers'
            ).catch(err => console.error('Failed to send error analytics:', err));
            throw error;
        }
    }

    export async function getTotalSubscribers(): Promise<number> {
        const client = await getClient();
        const result = await client.query<{ count: number }>(
            "select count(distinct(recipient)) as count from bra_subscriptions"
        );
        return [...result][0].count
    }

    export async function getLatestStoredBulletins(): Promise<BulletinInfos[]> {
        try {
            const client = await getClient();
            const result = await client.query<BulletinInfos>(
                "select massif, max(valid_from) as valid_from, max(valid_to) as valid_to from bras group by massif"
            );
            return [...result];
        } catch (error) {
            console.error('Database error in getLatestStoredBulletins:', error);
            await Analytics.sendError(
                error as Error,
                'Database.getLatestStoredBulletins'
            ).catch(err => console.error('Failed to send error analytics:', err));
            throw error;
        }
    }

    export async function insertBulletin(
        massif: number,
        filename: string,
        publicUrl: string,
        validFrom: Date,
        validTo: Date,
        riskLevel?: number
    ): Promise<void> {
        const client = await getClient();
        await client.query(
            "insert into bras (massif, filename, public_url, valid_from, valid_to, risk_level) values ($1, $2, $3, $4, $5, $6)",
            [massif, filename, publicUrl, validFrom, validTo, riskLevel]
        );
        console.log(`Inserted into database`);
    }

    export async function getMassifName(massifCode: number): Promise<string> {
        const client = await getClient();
        const result = await client.query<{ name: string }>(
            "select name from massifs where code=$1",
            [massifCode]
        );
        return [...result][0].name;
    }

    export async function getMassifNames(massifCodes: number[]): Promise<Array<{ code: number; name: string }>> {
        if (massifCodes.length === 0) {
            return [];
        }
        const client = await getClient();
        const placeholders = massifCodes.map((_, i) => `$${i + 1}`).join(',');
        const result = await client.query<{ code: number; name: string }>(
            `select code, name from massifs where code in (${placeholders})`,
            massifCodes
        );
        return [...result];
    }

    export async function insertBulletins(
        bulletins: Array<{
            massif: number;
            filename: string;
            publicUrl: string;
            validFrom: Date;
            validTo: Date;
            riskLevel?: number;
        }>
    ): Promise<void> {
        if (bulletins.length === 0) {
            return;
        }

        try {
            const client = await getClient();
            const values: any[] = [];
            const placeholders: string[] = [];

            bulletins.forEach((b, i) => {
                const base = i * 6;
                placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
                values.push(b.massif, b.filename, b.publicUrl, b.validFrom, b.validTo, b.riskLevel);
            });

            await client.query(
                `insert into bras (massif, filename, public_url, valid_from, valid_to, risk_level)
                values
                ${placeholders.join(', ')}`,
                values
            );
            console.log(`Batch inserted ${bulletins.length} bulletins into database`);
        } catch (error) {
            console.error(`Database error in insertBulletins (${bulletins.length} bulletins):`, error);
            await Analytics.sendError(
                error as Error,
                `Database.insertBulletins: Failed to insert ${bulletins.length} bulletins`
            ).catch(err => console.error('Failed to send error analytics:', err));
            throw error;
        }
    }

    export async function getSubscriptionsByMassif(): Promise<SubscriptionRow[]> {
        try {
            const client = await getClient();
            const result = await client.query<SubscriptionRow>(
                `select s.massif as massif, string_agg(s.recipient, ',') as recipients
                 from bra_subscriptions as s
                 group by s.massif;`
            );
            return [...result];
        } catch (error) {
            console.error('Database error in getSubscriptionsByMassif:', error);
            await Analytics.sendError(
                error as Error,
                'Database.getSubscriptionsByMassif'
            ).catch(err => console.error('Failed to send error analytics:', err));
            throw error;
        }
    }

    export async function getSubscriptionsByRecipients(recipients: string[], massif: number): Promise<Subscription[]> {
        if (recipients.length === 0) {
            return [];
        }

        const client = await getClient();
        const placeholders = recipients.map((_, i) => `$${i + 2}`).join(',');
        const result = await client.query(
            `SELECT recipient, massif, bulletin, snow_report, fresh_snow, weather, last_7_days, rose_pentes, montagne_risques
             FROM bra_subscriptions
             WHERE massif = $1 AND recipient::text IN (${placeholders})`,
            [massif, ...recipients]
        );

        return result.rows.map(row => ({
            recipient: row.get('recipient') as number,
            massif: row.get('massif') as number,
            bulletin: row.get('bulletin') as boolean,
            snow_report: row.get('snow_report') as boolean,
            fresh_snow: row.get('fresh_snow') as boolean,
            weather: row.get('weather') as boolean,
            last_7_days: row.get('last_7_days') as boolean,
            rose_pentes: row.get('rose_pentes') as boolean,
            montagne_risques: row.get('montagne_risques') as boolean,
        }));
    }
}