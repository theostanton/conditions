-- Migration: Add WhatsApp support via platform column
-- All existing rows default to 'telegram'

-- 1. Recipients table: add platform, change number to varchar
ALTER TABLE recipients ADD COLUMN platform VARCHAR(10) NOT NULL DEFAULT 'telegram';
ALTER TABLE recipients ALTER COLUMN number TYPE VARCHAR(30) USING number::text;
ALTER TABLE recipients DROP CONSTRAINT recipients_pkey;
ALTER TABLE recipients ADD PRIMARY KEY (number, platform);

-- 2. Subscriptions table: add platform, change recipient to varchar
ALTER TABLE bra_subscriptions ADD COLUMN platform VARCHAR(10) NOT NULL DEFAULT 'telegram';
ALTER TABLE bra_subscriptions ALTER COLUMN recipient TYPE VARCHAR(30) USING recipient::text;
ALTER TABLE bra_subscriptions DROP CONSTRAINT IF EXISTS bra_subscriptions_pkey;
ALTER TABLE bra_subscriptions DROP CONSTRAINT IF EXISTS bra_subscriptions_recipient_massif_key;
ALTER TABLE bra_subscriptions ADD CONSTRAINT bra_subscriptions_recipient_massif_platform_key
    UNIQUE (recipient, massif, platform);

-- 3. Deliveries table: add platform
ALTER TABLE deliveries_bras ADD COLUMN platform VARCHAR(10) NOT NULL DEFAULT 'telegram';
CREATE INDEX idx_deliveries_platform ON deliveries_bras (platform);
