-- Migration: Convert massif codes from INTEGER to TEXT
-- This enables non-numeric region codes (e.g. 'AT-07', 'BTAC/teton')
-- for multi-provider support.
--
-- The cast from integer to text is lossless: 15 → '15'
--
-- Run with: psql -f migrate_massif_codes_to_text.sql

BEGIN;

-- Drop foreign key constraints that reference massifs.code
-- (they'll block the type change since both sides must match)
ALTER TABLE geocode_cache DROP CONSTRAINT IF EXISTS geocode_cache_massif_code_fkey;
ALTER TABLE bras DROP CONSTRAINT IF EXISTS bras_massif_fkey;
ALTER TABLE bra_subscriptions DROP CONSTRAINT IF EXISTS bra_subscriptions_massif_fkey;
ALTER TABLE deliveries_bras DROP CONSTRAINT IF EXISTS deliveries_bras_massif_fkey;

-- 1. massifs.code  (primary key)
ALTER TABLE massifs
    ALTER COLUMN code TYPE text USING code::text;

-- 2. bras.massif
ALTER TABLE bras
    ALTER COLUMN massif TYPE text USING massif::text;

-- 3. bra_subscriptions.massif
ALTER TABLE bra_subscriptions
    ALTER COLUMN massif TYPE text USING massif::text;

-- 4. deliveries_bras.massif
ALTER TABLE deliveries_bras
    ALTER COLUMN massif TYPE text USING massif::text;

-- 5. geocode_cache.massif_code
ALTER TABLE geocode_cache
    ALTER COLUMN massif_code TYPE text USING massif_code::text;

-- 6. Re-add foreign key constraints (now both sides are text)
ALTER TABLE geocode_cache
    ADD CONSTRAINT geocode_cache_massif_code_fkey
    FOREIGN KEY (massif_code) REFERENCES massifs(code);

-- 7. Add provider and country columns to massifs
ALTER TABLE massifs
    ADD COLUMN provider text NOT NULL DEFAULT 'meteofrance',
    ADD COLUMN country  text NOT NULL DEFAULT 'France';

COMMIT;
