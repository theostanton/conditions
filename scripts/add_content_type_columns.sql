-- Migration script to add content type columns to bra_subscriptions table
-- These columns allow users to select which types of content they want to receive for each massif

-- Add content type columns if they don't exist
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS bulletin boolean DEFAULT true;
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS snow_report boolean DEFAULT false;
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS fresh_snow boolean DEFAULT false;
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS weather boolean DEFAULT false;
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS last_7_days boolean DEFAULT false;

-- Update existing subscriptions to have bulletin enabled by default
UPDATE bra_subscriptions SET bulletin = true WHERE bulletin IS NULL;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bra_subscriptions_recipient_massif_key'
    ) THEN
        ALTER TABLE bra_subscriptions ADD CONSTRAINT bra_subscriptions_recipient_massif_key UNIQUE (recipient, massif);
    END IF;
END $$;

-- Add comments to describe the columns
COMMENT ON COLUMN bra_subscriptions.bulletin IS 'Whether user wants to receive avalanche bulletins';
COMMENT ON COLUMN bra_subscriptions.snow_report IS 'Whether user wants to receive snow reports';
COMMENT ON COLUMN bra_subscriptions.fresh_snow IS 'Whether user wants to receive fresh snow alerts';
COMMENT ON COLUMN bra_subscriptions.weather IS 'Whether user wants to receive weather updates';
COMMENT ON COLUMN bra_subscriptions.last_7_days IS 'Whether user wants to receive last 7 days summary';
