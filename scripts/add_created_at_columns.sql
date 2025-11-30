-- Add created_at column to recipients table
ALTER TABLE recipients
ADD COLUMN created_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Add created_at column to bra_subscriptions table
ALTER TABLE bra_subscriptions
ADD COLUMN created_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Create indexes for querying by creation date
CREATE INDEX IF NOT EXISTS idx_recipients_created_at ON recipients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bra_subscriptions_created_at ON bra_subscriptions (created_at DESC);

-- Add comments to document the columns
COMMENT ON COLUMN recipients.created_at IS 'Timestamp when the recipient was first added to the system';
COMMENT ON COLUMN bra_subscriptions.created_at IS 'Timestamp when the subscription was created';
