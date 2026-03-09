-- Add conditions_report opt-in flag to subscriptions
ALTER TABLE bra_subscriptions ADD COLUMN conditions_report BOOLEAN NOT NULL DEFAULT false;
