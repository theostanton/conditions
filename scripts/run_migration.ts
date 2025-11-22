import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const client = new Client({
        host: '35.205.236.38',
        port: 5432,
        user: 'postgres',
        password: process.env.PGPASSWORD || '',
        database: 'database',
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully');

        const migrationPath = path.join(__dirname, 'add_content_type_columns.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
