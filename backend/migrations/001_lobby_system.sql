-- Empties the players table: it only ever ran on the first install. Databases built from schema.sql record it
-- as applied and never run it.

-- Add lobby status to game table
ALTER TABLE game
  ALTER COLUMN status TYPE VARCHAR(20),
  ALTER COLUMN status SET DEFAULT 'lobby';

-- Add ready_to_start column to players table to track votes
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS ready_to_start BOOLEAN DEFAULT false;

-- Reset properties BEFORE deleting players (foreign key constraint)
UPDATE properties SET owner_id = NULL, is_mortgaged = false, house_count = 0;

-- Clear game actions BEFORE deleting players (foreign key constraint)
DELETE FROM game_actions;

-- Clear existing players (they'll need to rejoin)
DELETE FROM players;

-- Update existing game to lobby status
UPDATE game SET status = 'lobby', started_at = NULL WHERE id = 1;
