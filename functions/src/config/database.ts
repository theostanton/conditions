import { Client, connect } from "ts-postgres";
import { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } from "./index";

let client: Client;

export async function setupDatabase() {
    client = await connect({
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
    });
}

export function getClient(): Client {
    return client;
}
