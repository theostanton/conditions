import type {Massif} from "../types";
import {getClient} from "./connection";

export namespace Subscriptions {

    export async function subscribe(userId: number, massif: Massif): Promise<void> {
        const client = getClient();
        await client.query("INSERT INTO recipients (number) VALUES ($1) on conflict(number) DO NOTHING", [userId]);
        await client.query("INSERT INTO subscriptions_bras (recipient, massif) VALUES ($1, $2)", [userId, massif.code]);
    }

    export async function unsubscribe(userId: number, massif: Massif): Promise<void> {
        const client = getClient();
        await client.query("DELETE FROM subscriptions_bras WHERE recipient = $1 AND massif = $2", [userId, massif.code]);
    }

    export async function unsubscribeAll(userId: number): Promise<void> {
        const client = getClient();
        await client.query("DELETE FROM subscriptions_bras WHERE recipient = $1", [userId]);
    }

}