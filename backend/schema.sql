-- Full schema for a fresh database (equivalent to the original schema plus every file in migrations/).
-- After this, run: node scripts/seedProperties.js

-- users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- taxi, pigeon, rat, subway, bull, empire
    token_version INTEGER NOT NULL DEFAULT 0, -- bumped on password change; older login tokens stop working
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_username_lower_key ON users (LOWER(username));

-- Seed data for 6 users. Each password equals the username: change them with POST /api/auth/password
-- (or an admin reset) before the site is public.
INSERT INTO users (username, password_hash, token_type) VALUES
('max', '$2b$10$jnXGoa.8Qpsfr/PvTghnmuEbIzN2BkiOo/dv9JoTMlb6dcXFSDpQu', 'taxi'),
('jack', '$2b$10$dEQD1dFv/lvkOZnpyO1JXe0z0xXb8DkVh4am5odK8dHXimT/Ub9Ry', 'pigeon'),
('youngeun', '$2b$10$x2oDLOCXtyKLavbdOUxT4uKdJYeGHm8msXfD.omEkGQoEPmXxhJAW', 'rat'),
('seabass', '$2b$10$JHrxXJYe/xkH9SfbA4xNR.bna2tM3jfnBrVTU5JeuYYWjDw6T/Fdy', 'subway'),
('jason', '$2b$10$NTUXBZ/8aJ5AjznCX6levOFxkX7ysA3tM8nfKZdnoUNnXCbAk.Bj2', 'bull'),
('raymond', '$2b$10$QwwsX3Yy0Ac8FZtrykDQPudXzVqz2wd0evGvQU1Y.lmuh0XcoB7nq', 'empire');

-- game Table (Single Row)
CREATE TABLE game (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'lobby', -- lobby, in_progress, completed
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_turn_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    turn_deadline TIMESTAMPTZ,
    settings JSONB DEFAULT '{"starting_money": 1500, "go_salary": 200, "turn_hours": 24}'::jsonb,
    turn_state JSONB NOT NULL DEFAULT '{}'::jsonb, -- phase, rolled, doubles, lastRoll, pendingPropertyId, debts
    decks JSONB NOT NULL DEFAULT '{}'::jsonb,      -- shuffled Opportunity / Community Fund order
    version INTEGER NOT NULL DEFAULT 0,            -- bumped on every change; clients drop older snapshots
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Single game instance
INSERT INTO game (id, status) VALUES (1, 'lobby');

-- players Table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    money INTEGER NOT NULL DEFAULT 1500,
    position INTEGER DEFAULT 0, -- 0-39
    is_in_jail BOOLEAN DEFAULT false,
    jail_turns INTEGER DEFAULT 0,
    get_out_of_jail_cards INTEGER DEFAULT 0,
    is_bankrupt BOOLEAN DEFAULT false,
    turn_order INTEGER NOT NULL,
    ready_to_start BOOLEAN DEFAULT false,
    player_color VARCHAR(20),
    last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- properties Table
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    property_type VARCHAR(20) NOT NULL, -- property, railroad, utility
    color_group VARCHAR(20),
    position_on_board INTEGER NOT NULL, -- 0-39
    purchase_price INTEGER NOT NULL,
    rent_base INTEGER NOT NULL,
    rent_values JSONB, -- [base, full set, 1-4 houses, hotel] or railroad [1-4 owned]
    house_cost INTEGER,
    mortgage_value INTEGER NOT NULL,
    owner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    is_mortgaged BOOLEAN DEFAULT false,
    house_count INTEGER DEFAULT 0 CONSTRAINT properties_house_count_range CHECK (house_count BETWEEN 0 AND 5), -- 5 = hotel
    UNIQUE(game_id, position_on_board)
);

-- trades Table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    proposer_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    recipient_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, cancelled, countered, expired
    offered_properties JSONB DEFAULT '[]'::jsonb, -- Array of property IDs
    offered_money INTEGER NOT NULL DEFAULT 0,
    offered_jail_cards INTEGER NOT NULL DEFAULT 0,
    requested_properties JSONB DEFAULT '[]'::jsonb, -- Array of property IDs
    requested_money INTEGER NOT NULL DEFAULT 0,
    requested_jail_cards INTEGER NOT NULL DEFAULT 0,
    countered_from INTEGER REFERENCES trades(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trades_amounts_nonnegative
      CHECK (offered_money >= 0 AND requested_money >= 0 AND offered_jail_cards >= 0 AND requested_jail_cards >= 0)
);

CREATE INDEX idx_trades_status ON trades(status);

-- game_actions Table (History/Audit Log)
CREATE TABLE game_actions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- roll, move, buy, rent, card, build, trade_accepted, ...
    action_data JSONB, -- event data plus a ready-to-show "text"
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient history queries
CREATE INDEX idx_game_actions_timestamp ON game_actions(game_id, timestamp DESC);
CREATE INDEX idx_game_actions_player ON game_actions(player_id, timestamp DESC);

-- game_chat Table
CREATE TABLE game_chat (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_chat_timestamp ON game_chat(game_id, timestamp DESC);
