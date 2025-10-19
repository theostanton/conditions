import {getClient} from "@config/database";
import {BulletinInfos} from "@app-types";

type SubscriptionRow = {
    massif: number,
    recipients: string
}

export namespace Database {
    export async function getMassifsWithSubscribers(): Promise<number[]> {
        const client = getClient();
        const result = await client.query<Pick<BulletinInfos, "massif">>(
            "select concat(massif) as massif from subscriptions_bras group by massif"
        );
        return [...result].map(s => s.massif);
    }

    export async function getLatestStoredBulletins(): Promise<BulletinInfos[]> {
        const client = getClient();
        const result = await client.query<BulletinInfos>(
            "select massif, max(valid_from) as valid_from, max(valid_to) as valid_to from bras group by massif"
        );
        return [...result];
    }

    export async function insertBulletin(
        massif: number,
        filename: string,
        publicUrl: string,
        validFrom: Date,
        validTo: Date
    ): Promise<void> {
        const client = getClient();
        await client.query(
            "insert into bras (massif, filename, public_url, valid_from, valid_to) values ($1, $2, $3, $4, $5)",
            [massif, filename, publicUrl, validFrom, validTo]
        );
        console.log(`Inserted into database`);
    }

    export async function getMassifName(massifCode: number): Promise<string> {
        const client = getClient();
        const result = await client.query<{ name: string }>(
            "select name from massifs where code=$1",
            [massifCode]
        );
        return [...result][0].name;
    }

    export async function getSubscriptionsByMassif(): Promise<SubscriptionRow[]> {
        const client = getClient();
        const result = await client.query<SubscriptionRow>(
            `select s.massif as massif, string_agg(s.recipient, ',') as recipients
             from subscriptions_bras as s
             group by s.massif;`
        );
        return [...result];
    }
}