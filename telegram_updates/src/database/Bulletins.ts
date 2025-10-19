import {getClient} from "./connection";

export namespace Bulletins {
    export async function getLatest(massifCode: number): Promise<{ public_url: string; valid_to: Date } | undefined> {
        const client = getClient();
        const result = await client.query<{ public_url: string; valid_to: Date }>(
            "select b.public_url,b.valid_to from bras as b where b.massif = $1 order by b.valid_to desc limit 1;",
            [massifCode]
        );
        return [...result][0];
    }
}