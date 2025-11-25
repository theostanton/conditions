create table massifs
(
    name        text not null,
    code        integer primary key,
    departement text,
    mountain    text
);

create table recipients
(
    number varchar(12) not null
        unique
);

create table bra_subscriptions
(
    recipient   varchar(12) not null,
    massif      integer,
    bulletin    boolean default true,
    snow_report boolean default false,
    fresh_snow  boolean default false,
    weather     boolean default false,
    last_7_days boolean default false,
    UNIQUE (recipient, massif)
);

create table bras
(
    massif     integer   not null,
    filename   text      not null,
    public_url text      not null,
    valid_to   timestamp not null,
    valid_from timestamp not null,
    risk_level integer
);

comment on column bras.risk_level is 'Maximum avalanche risk level from RISQUEMAXI (1=Low to 5=Very High)';

alter table bras
    owner to postgres;



create table public.deliveries_bras
(
    recipient          varchar(12) not null,
    massif             integer     not null,
    delivery_timestamp timestamp   not null,
    valid_from         timestamp   not null
);

alter table public.deliveries_bras
    owner to postgres;



-- Index for fast delivery checks during notification generation
CREATE INDEX IF NOT EXISTS idx_deliveries_bras_lookup ON deliveries_bras (massif, valid_from, recipient);

CREATE TABLE IF NOT EXISTS cron_executions
(
    id                             SERIAL PRIMARY KEY,
    executed_at                    TIMESTAMP DEFAULT NOW(),
    status                         VARCHAR(20) NOT NULL,
    subscriber_count               INTEGER,
    massifs_with_subscribers_count INTEGER,
    updated_bulletins_count        INTEGER,
    bulletins_delivered_count      INTEGER,
    summary                        TEXT,
    error_message                  TEXT,
    duration_ms                    INTEGER
);

-- Create index on executed_at for quick lookups of recent executions
CREATE INDEX IF NOT EXISTS idx_cron_executions_executed_at ON cron_executions (executed_at DESC);

-- Create index on status for filtering by execution status
CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_executions (status);

-- Performance indexes for bot commands
-- For Massifs.getByMountain() query
CREATE INDEX IF NOT EXISTS idx_massifs_mountain ON massifs (mountain);

-- For Subscriptions.isSubscribed() query
CREATE INDEX IF NOT EXISTS idx_subscriptions_recipient_massif ON bra_subscriptions (recipient, massif);

-- For Massifs.getAllForRecipient() query
CREATE INDEX IF NOT EXISTS idx_subscriptions_recipient ON bra_subscriptions (recipient);

-- For Bulletins.getLatest() query - covering index for massif and valid_to
CREATE INDEX IF NOT EXISTS idx_bras_massif_valid_to ON bras (massif, valid_to DESC);