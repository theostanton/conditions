import type {Massif} from "@app-types";
import {getClient} from "@config/database";

export namespace Massifs {

    export async function getAllForRecipient(userId: number): Promise<Massif[]> {
        const client = getClient();
        const result = await client.query<Massif>(
            "SELECT m.name, m.code FROM subscriptions_bras as sb left join massifs m on sb.massif = m.code WHERE sb.recipient = $1",
            [userId]
        );
        return [...result];
    }

    export async function getAll(): Promise<Massif[]> {
        const client = getClient();
        const result = await client.query<Massif>("SELECT name,code FROM massifs ORDER BY name");
        return [...result];
    }

}