-- Migration: Convert massif codes from INTEGER to TEXT
-- This enables non-numeric region codes (e.g. 'AT-07', 'BTAC/teton')
-- for multi-provider support.
--
-- The cast from integer to text is lossless: 15 → '15'
--
-- Run with: ./apply_migration.sh migrate_massif_codes_to_text.sql

BEGIN;

-- 1. massifs.code  (primary key)
ALTER TABLE massifs
    ALTER COLUMN code TYPE text USING code::text;

-- 2. bras.massif  (references massifs.code)
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

-- 6. Add provider and country columns to massifs
ALTER TABLE massifs
    ADD COLUMN provider text NOT NULL DEFAULT 'meteofrance',
    ADD COLUMN country  text NOT NULL DEFAULT 'France';

COMMIT;
