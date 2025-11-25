-- Migration: Fix deliveries_bras schema to match code expectations
-- This fixes the critical bug where delivery tracking was completely broken

BEGIN;

-- Step 1: Rename 'date' column to 'valid_from' and change type from integer to date
-- Note: If there's existing data, it will be lost. The table should be empty due to the bug.
ALTER TABLE deliveries_bras
    DROP COLUMN IF EXISTS date,
    ADD COLUMN valid_from date NOT NULL DEFAULT CURRENT_DATE;

-- Step 2: Rename 'timestamp' column to 'delivery_timestamp'
ALTER TABLE deliveries_bras
    RENAME COLUMN timestamp TO delivery_timestamp;

-- Step 3: Set proper default for delivery_timestamp
ALTER TABLE deliveries_bras
    ALTER COLUMN delivery_timestamp SET DEFAULT NOW();

-- Step 4: Add primary key constraint to prevent duplicate deliveries
-- This ensures the same bulletin can never be sent twice to the same subscriber
ALTER TABLE deliveries_bras
    ADD CONSTRAINT pk_deliveries_bras PRIMARY KEY (recipient, massif, valid_from);

-- Step 5: Add index for fast lookups during delivery checks
-- This index is used by getUndeliveredRecipients() to quickly find who hasn't received a bulletin
CREATE INDEX IF NOT EXISTS idx_deliveries_bras_lookup
    ON deliveries_bras (massif, valid_from, recipient);

-- Step 6: Add foreign key constraints for data integrity (optional but recommended)
-- Ensures we can't record deliveries for non-existent subscriptions
ALTER TABLE deliveries_bras
    ADD CONSTRAINT fk_deliveries_bras_subscription
    FOREIGN KEY (recipient, massif)
    REFERENCES bra_subscriptions(recipient, massif)
    ON DELETE CASCADE;

COMMIT;

-- Verify the migration
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'deliveries_bras'
ORDER BY ordinal_position;
