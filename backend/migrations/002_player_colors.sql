-- Add player_color column to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS player_color VARCHAR(20);

-- Assign colors to existing players based on turn order
-- Colors: red, blue, green, yellow, purple, orange
UPDATE players SET player_color = CASE turn_order
  WHEN 1 THEN 'red'
  WHEN 2 THEN 'blue'
  WHEN 3 THEN 'green'
  WHEN 4 THEN 'yellow'
  WHEN 5 THEN 'purple'
  WHEN 6 THEN 'orange'
  ELSE 'gray'
END;
