-- Add message_logs table for tracking all messages sent to the bot
CREATE TABLE IF NOT EXISTS message_logs
(
    id         SERIAL PRIMARY KEY,
    recipient  VARCHAR(12) NOT NULL,
    timestamp  TIMESTAMP DEFAULT NOW() NOT NULL,
    message    TEXT NOT NULL
);

-- Index for querying messages by timestamp
CREATE INDEX IF NOT EXISTS idx_message_logs_timestamp ON message_logs (timestamp DESC);

-- Index for querying messages by recipient
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient ON message_logs (recipient);
