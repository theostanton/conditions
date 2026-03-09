-- Create conditions_reports table for caching AI-generated reports
CREATE TABLE conditions_reports (
    id SERIAL PRIMARY KEY,
    massif VARCHAR(20) NOT NULL,
    bulletin_valid_from TIMESTAMP NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    report_full TEXT NOT NULL,
    report_short TEXT NOT NULL,
    report_json JSONB NOT NULL,
    prompt_version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(massif, bulletin_valid_from)
);
