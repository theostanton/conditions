import type {Massif} from "@app-types";
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

    export async function subscribe(userId: number, massif: Massif): Promise<void> {
        const client = await getClient();
        await client.query("INSERT INTO recipients (number) VALUES ($1) on conflict(number) DO NOTHING", [userId]);
        await client.query("INSERT INTO bra_subscriptions (recipient, massif) VALUES ($1, $2)", [userId, massif.code]);
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