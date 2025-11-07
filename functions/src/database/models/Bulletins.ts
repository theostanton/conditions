import {getClient} from "@config/database";
import {Bulletin} from "@app-types";

export namespace Bulletins {
    export async function getLatest(massifCode: number): Promise<Bulletin | undefined> {
        const client = await getClient();
        const result = await client.query<Bulletin>(
            "select * from bras where massif = $1 order by valid_from desc limit 1;",
            [massifCode]
        );
        return [...result][0];
    }
}