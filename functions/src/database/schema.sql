create table massifs
(
    name text not null,
    code integer
);

create table recipients
(
    number varchar(12) not null
        unique
);

create table bra_subscriptions
(
    recipient varchar(12) not null,
    massif    integer
);

create table bras
(
    massif     integer     not null,
    date       varchar(10) not null,
    filename   text        not null,
    public_url text        not null
);

create table deliveries_bras
(
    recipient varchar(12) not null,
    massif    integer     not null,
    date      integer     not null,
    timestamp timestamp
);

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

-- Create index on executed_at for quick lookups of recent executions
CREATE INDEX IF NOT EXISTS idx_cron_executions_executed_at ON cron_executions(executed_at DESC);

-- Create index on status for filtering by execution status
CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_executions(status);