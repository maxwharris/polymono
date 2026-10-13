-- Phone alerts (a private ntfy topic per player) and the results of finished games.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_topic TEXT;

CREATE TABLE IF NOT EXISTS game_history (
    id SERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    standings JSONB NOT NULL -- [{ userId, username, tokenType, netWorth, money, properties, bankrupt }], best first
);

-- Databases built from the original schema still default game.settings to the old keys; match schema.sql.
ALTER TABLE game ALTER COLUMN settings SET DEFAULT '{"starting_money": 1500, "go_salary": 200, "turn_hours": 24}'::jsonb;
