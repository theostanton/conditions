import {Client, connect} from "ts-postgres";
import {PGHOST, PGDATABASE, PGUSER, PGPASSWORD} from "./envs";

let client: Client | null = null;

export async function setupDatabase() {
    console.log('setupDatabase PGHOST ' + PGHOST + ', database ' + PGDATABASE);
    client = await connect({
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
    });
}

async function ensureConnection(): Promise<Client> {
    // Check if client exists and connection is still open
    if (client && !client.closed) {
        return client;
    }

    // Connection is closed or doesn't exist, reconnect
    console.log('Database connection closed or not established, reconnecting...');
    await setupDatabase();

    if (!client) {
        throw new Error('Failed to establish database connection');
    }

    return client;
}

export async function getClient(): Promise<Client> {
    return ensureConnection();
}

export async function closeConnection(): Promise<void> {
    if (client && !client.closed) {
        console.log('Closing database connection...');
        await client.end();
        client = null;
    }
}
