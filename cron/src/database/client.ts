import { Client, connect } from "ts-postgres";

let client: Client;

export async function setupDatabase() {
    client = await connect({
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
    });
}

export function getClient(): Client {
    return client;
}
