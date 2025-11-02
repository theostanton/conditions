-- Migration: Add departement and mountain columns to massifs table
-- and add primary key constraint on code

-- Add new columns (if they don't exist)
ALTER TABLE massifs ADD COLUMN IF NOT EXISTS departement text;
ALTER TABLE massifs ADD COLUMN IF NOT EXISTS mountain text;

-- Remove duplicates, keeping only one row per code
-- Create a temporary table with unique codes
CREATE TEMP TABLE massifs_unique AS
SELECT DISTINCT ON (code) code, name, departement, mountain
FROM massifs
ORDER BY code;

-- Delete all rows from massifs
DELETE FROM massifs;

-- Insert unique rows back
INSERT INTO massifs (code, name, departement, mountain)
SELECT code, name, departement, mountain FROM massifs_unique;

-- Drop temporary table
DROP TABLE massifs_unique;

-- Add primary key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'massifs_pkey'
        AND conrelid = 'massifs'::regclass
    ) THEN
        ALTER TABLE massifs ADD PRIMARY KEY (code);
    END IF;
END $$;
