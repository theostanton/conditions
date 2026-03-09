-- Add metadata_json column to bras table for enriched bulletin metadata
ALTER TABLE bras ADD COLUMN metadata_json JSONB DEFAULT NULL;
