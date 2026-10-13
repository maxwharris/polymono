-- Phone alerts (a private ntfy topic per player) and the results of finished games.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_topic TEXT;

CREATE TABLE IF NOT EXISTS game_history (
    id SERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    standings JSONB NOT NULL -- [{ userId, username, tokenType, netWorth, money, properties, bankrupt }], best first
);
