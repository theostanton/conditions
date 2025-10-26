import {Client, connect} from "ts-postgres";
import {PGHOST, PGDATABASE, PGUSER, PGPASSWORD} from "./envs";

let client: Client;

async function runMigrations(client: Client) {
    // Create cron_executions table if it doesn't exist
    await client.query(`
        CREATE TABLE IF NOT EXISTS cron_executions (
            id SERIAL PRIMARY KEY,
            executed_at TIMESTAMP DEFAULT NOW(),
            status VARCHAR(20) NOT NULL,
            subscriber_count INTEGER,
            massifs_with_subscribers_count INTEGER,
            updated_bulletins_count INTEGER,
            bulletins_delivered_count INTEGER,
            summary TEXT,
            error_message TEXT,
            duration_ms INTEGER
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cron_executions_executed_at ON cron_executions(executed_at DESC);
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_executions(status);
    `);

    console.log('Database migrations completed');
}

export async function setupDatabase() {
    console.log('setupDatabase PGHOST ' + PGHOST + ', database ' + PGDATABASE);
    client = await connect({
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
    });

    await runMigrations(client);
}

export function getClient(): Client {
    return client;
}
