import {getClient} from "@config/database";

export type CronExecutionStatus = 'success' | 'partial' | 'failed';

export interface CronExecution {
    status: CronExecutionStatus;
    subscriber_count?: number;
    massifs_with_subscribers_count?: number;
    updated_bulletins_count?: number;
    bulletins_delivered_count?: number;
    summary?: string;
    error_message?: string;
    duration_ms?: number;
}

export namespace CronExecutions {
    export async function insert(data: CronExecution): Promise<void> {
        const client = getClient();
        await client.query(
            `insert into cron_executions
             (status, subscriber_count, massifs_with_subscribers_count, updated_bulletins_count,
              bulletins_delivered_count, summary, error_message, duration_ms)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                data.status,
                data.subscriber_count ?? null,
                data.massifs_with_subscribers_count ?? null,
                data.updated_bulletins_count ?? null,
                data.bulletins_delivered_count ?? null,
                data.summary ?? null,
                data.error_message ?? null,
                data.duration_ms ?? null
            ]
        );
        console.log('Cron execution record inserted');
    }
}