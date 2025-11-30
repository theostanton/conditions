import {getClient} from "@config/database";

export interface MessageLog {
    id?: number;
    recipient: string;
    timestamp?: Date;
    message: string;
}

export namespace MessageLogs {
    export async function insert(recipient: string, message: string): Promise<void> {
        const client = await getClient();
        await client.query(
            `insert into message_logs (recipient, message)
             values ($1, $2)`,
            [recipient, message]
        );
    }

    export async function getByRecipient(recipient: string, limit = 100): Promise<MessageLog[]> {
        const client = await getClient();
        const result = await client.query(
            `select id, recipient, timestamp, message
             from message_logs
             where recipient = $1
             order by timestamp desc
             limit $2`,
            [recipient, limit]
        );
        return result.rows as unknown as MessageLog[];
    }

    export async function getRecent(limit = 100): Promise<MessageLog[]> {
        const client = await getClient();
        const result = await client.query(
            `select id, recipient, timestamp, message
             from message_logs
             order by timestamp desc
             limit $1`,
            [limit]
        );
        return result.rows as unknown as MessageLog[];
    }
}
