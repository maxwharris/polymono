-- Server-side turn state, shuffled card decks, counter-offer links and safer foreign keys.
-- Runs after 001_lobby_system.sql and 002_player_colors.sql. Safe to re-run; it never deletes game data.

ALTER TABLE game ALTER COLUMN status SET DEFAULT 'lobby';
ALTER TABLE game ADD COLUMN IF NOT EXISTS turn_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE game ADD COLUMN IF NOT EXISTS decks JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE game ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game ADD COLUMN IF NOT EXISTS winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
UPDATE game SET settings = '{"starting_money": 1500, "go_salary": 200, "turn_hours": 24}'::jsonb || COALESCE(settings, '{}'::jsonb)
  WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'turn_hours');

-- Login and admin checks match usernames case-insensitively, so they must be unique that way too.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (LOWER(username));

-- Bumped on password change: tokens carry it, so older tokens stop working.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE players ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_color VARCHAR(20);
UPDATE players SET money = 0 WHERE money IS NULL;
ALTER TABLE players ALTER COLUMN money SET NOT NULL;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS countered_from INTEGER REFERENCES trades(id) ON DELETE SET NULL;
UPDATE trades SET offered_money = COALESCE(offered_money, 0), requested_money = COALESCE(requested_money, 0),
  offered_jail_cards = COALESCE(offered_jail_cards, 0), requested_jail_cards = COALESCE(requested_jail_cards, 0);
ALTER TABLE trades ALTER COLUMN offered_money SET NOT NULL, ALTER COLUMN requested_money SET NOT NULL,
  ALTER COLUMN offered_jail_cards SET NOT NULL, ALTER COLUMN requested_jail_cards SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE trades ADD CONSTRAINT trades_amounts_nonnegative
    CHECK (offered_money >= 0 AND requested_money >= 0 AND offered_jail_cards >= 0 AND requested_jail_cards >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_house_count_range CHECK (house_count BETWEEN 0 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Deleting a user or player no longer fails on their chat, log or trade rows.
ALTER TABLE game_chat DROP CONSTRAINT IF EXISTS game_chat_user_id_fkey,
  ADD CONSTRAINT game_chat_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE game_actions DROP CONSTRAINT IF EXISTS game_actions_player_id_fkey,
  ADD CONSTRAINT game_actions_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_owner_id_fkey,
  ADD CONSTRAINT properties_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_proposer_id_fkey,
  ADD CONSTRAINT trades_proposer_id_fkey FOREIGN KEY (proposer_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_recipient_id_fkey,
  ADD CONSTRAINT trades_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE game DROP CONSTRAINT IF EXISTS game_current_turn_user_id_fkey,
  ADD CONSTRAINT game_current_turn_user_id_fkey FOREIGN KEY (current_turn_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- The 3D token models are taxi, pigeon, rat, subway, bull and empire; map the original token names onto them.
UPDATE users SET token_type = CASE token_type
  WHEN 'car' THEN 'taxi' WHEN 'hat' THEN 'pigeon' WHEN 'dog' THEN 'rat'
  WHEN 'ship' THEN 'subway' WHEN 'thimble' THEN 'bull' WHEN 'shoe' THEN 'empire' ELSE token_type END
WHERE token_type IN ('car', 'hat', 'dog', 'ship', 'thimble', 'shoe');

-- A game marked in progress with nobody in it can never be joined; put it back in the lobby.
UPDATE game SET status = 'lobby', started_at = NULL, current_turn_user_id = NULL, turn_deadline = NULL, turn_state = '{}'::jsonb
WHERE id = 1 AND status = 'in_progress' AND NOT EXISTS (SELECT 1 FROM players);

-- Timestamps carry their time zone, so deadlines written by Postgres and by Node agree whatever the machine's
-- zone. Existing values were written on the box, which runs in UTC.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
                   c.table_name, c.column_name, c.column_name);
  END LOOP;
END $$;
