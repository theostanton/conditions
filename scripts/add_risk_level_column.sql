-- Migration script to add risk_level column to bras table
-- This column stores the RISQUEMAXI value from the bulletin XML (values 1-5)

-- Add the risk_level column if it doesn't exist
ALTER TABLE bras ADD COLUMN IF NOT EXISTS risk_level integer;

-- Add a comment to describe the column
COMMENT ON COLUMN bras.risk_level IS 'Maximum avalanche risk level from RISQUEMAXI (1=Low to 5=Very High)';
