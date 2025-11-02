import type {Massif} from "@app-types";
import {getClient} from "@config/database";

export namespace Massifs {

    export async function getAllForRecipient(userId: number): Promise<Massif[]> {
        const client = getClient();
        const result = await client.query<Massif>(
            "SELECT m.name, m.code, m.mountain FROM bra_subscriptions as sb left join massifs m on sb.massif = m.code WHERE sb.recipient = $1",
            [userId]
        );
        return [...result];
    }

    export async function getAll(): Promise<Massif[]> {
        const client = getClient();
        const result = await client.query<Massif>("SELECT name,code,mountain FROM massifs ORDER BY name");
        return [...result];
    }

    export async function getDistinctMountains(): Promise<string[]> {
        const client = getClient();
        const result = await client.query<{mountain: string}>("SELECT DISTINCT mountain FROM massifs WHERE mountain IS NOT NULL ORDER BY mountain");
        return [...result].map(row => row.mountain);
    }

    export async function getByMountain(mountain: string): Promise<Massif[]> {
        const client = getClient();
        const result = await client.query<Massif>("SELECT name,code,mountain FROM massifs WHERE mountain = $1 ORDER BY name", [mountain]);
        return [...result];
    }

}