-- backend/schema.sql as first committed (7d74f77, "first"), before any migration. Never edit: npm test
-- applies every migration to it and checks the result matches schema.sql.

-- users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data for 5 hardcoded users
INSERT INTO users (username, password_hash, token_type) VALUES
('player1', '$2b$10$M9Sn7PskjWvamaLGcIzoB.ESXGdp8W.KEQ1pssVw2vYSNP7/RAUwK', 'car'),
('player2', '$2b$10$uWv.yLiSybKZkzavMfvSFOMTjYrsx14yB.GY5ZmfkFIM5/kLU0xO6', 'hat'),
('player3', '$2b$10$TOhKjw./7CEw5o0c4m5NDOcHcvckiLKXHoBIFb9KFJbqd0WaqbxYS', 'dog'),
('player4', '$2b$10$r66bH87th2MGi6iy0JBEdOzB7ITTEs/YTj2xqym9ChmCc0vAZuB1C', 'ship'),
('player5', '$2b$10$tgeNudsDqlgwSFDvcvRKu.luzFtNZhtFe/nQ5.MT5iukn8.I0pl9W', 'thimble');

-- game Table (Single Row)
CREATE TABLE game (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_turn_user_id INTEGER REFERENCES users(id),
    turn_deadline TIMESTAMP,
    settings JSONB DEFAULT '{"starting_money": 1500, "free_parking_money": 0, "go_salary": 200}'::jsonb
);

-- Single game instance
INSERT INTO game (id, status, started_at) VALUES (1, 'in_progress', CURRENT_TIMESTAMP);

-- players Table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    money INTEGER DEFAULT 1500,
    position INTEGER DEFAULT 0, -- 0-39
    is_in_jail BOOLEAN DEFAULT false,
    jail_turns INTEGER DEFAULT 0,
    get_out_of_jail_cards INTEGER DEFAULT 0,
    is_bankrupt BOOLEAN DEFAULT false,
    turn_order INTEGER NOT NULL,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- properties Table
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    property_type VARCHAR(20) NOT NULL, -- standard, railroad, utility
    color_group VARCHAR(20),
    position_on_board INTEGER NOT NULL, -- 0-39
    purchase_price INTEGER NOT NULL,
    rent_base INTEGER NOT NULL,
    rent_values JSONB, -- Array of rent values for houses/hotel
    house_cost INTEGER,
    mortgage_value INTEGER NOT NULL,
    owner_id INTEGER REFERENCES players(id),
    is_mortgaged BOOLEAN DEFAULT false,
    house_count INTEGER DEFAULT 0, -- 0-5, where 5 = hotel
    UNIQUE(game_id, position_on_board)
);

-- trades Table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    proposer_id INTEGER REFERENCES players(id) NOT NULL,
    recipient_id INTEGER REFERENCES players(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, countered
    offered_properties JSONB DEFAULT '[]'::jsonb, -- Array of property IDs
    offered_money INTEGER DEFAULT 0,
    offered_jail_cards INTEGER DEFAULT 0,
    requested_properties JSONB DEFAULT '[]'::jsonb, -- Array of property IDs
    requested_money INTEGER DEFAULT 0,
    requested_jail_cards INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- game_actions Table (History/Audit Log)
CREATE TABLE game_actions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    player_id INTEGER REFERENCES players(id),
    action_type VARCHAR(50) NOT NULL, -- roll, buy_property, build, trade, pay_rent, etc.
    action_data JSONB, -- Flexible JSON for action-specific data
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient history queries
CREATE INDEX idx_game_actions_timestamp ON game_actions(game_id, timestamp DESC);
CREATE INDEX idx_game_actions_player ON game_actions(player_id, timestamp DESC);

-- game_chat Table
CREATE TABLE game_chat (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES game(id) DEFAULT 1,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_chat_timestamp ON game_chat(game_id, timestamp DESC);
