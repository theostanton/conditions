-- Migration script to add rose_pentes and montagne_risques content type columns
-- These columns allow users to select additional types of content they want to receive

-- Add new content type columns if they don't exist
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS rose_pentes boolean DEFAULT false;
ALTER TABLE bra_subscriptions ADD COLUMN IF NOT EXISTS montagne_risques boolean DEFAULT false;

-- Add comments to describe the columns
COMMENT ON COLUMN bra_subscriptions.rose_pentes IS 'Whether user wants to receive rose des pentes (slope orientation risk chart)';
COMMENT ON COLUMN bra_subscriptions.montagne_risques IS 'Whether user wants to receive montagne risques (mountain risks map)';
