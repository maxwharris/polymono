const pool = require('../db');

// Every function takes `db` (the pool, or a transaction client) as its first argument.

const PLAYER_COLUMNS = ['money', 'position', 'is_in_jail', 'jail_turns', 'get_out_of_jail_cards', 'is_bankrupt',
  'turn_order', 'ready_to_start', 'player_color'];
const PROPERTY_COLUMNS = ['owner_id', 'is_mortgaged', 'house_count'];
const GAME_COLUMNS = ['status', 'current_turn_user_id', 'turn_deadline', 'started_at', 'completed_at', 'turn_state',
  'decks', 'winner_user_id', 'settings'];

// Builds "col = $n" pairs from a whitelist. Unlike COALESCE updates, null is written as null.
function setClause(fields, allowed, offset) {
  const cols = Object.keys(fields).filter(k => fields[k] !== undefined);
  for (const c of cols) {
    if (!allowed.includes(c)) throw new Error(`Unknown column ${c}`);
  }
  return {
    sql: cols.map((c, i) => `${c} = $${i + offset}`).join(', '),
    values: cols.map(c => (fields[c] !== null && typeof fields[c] === 'object' && !(fields[c] instanceof Date)
      ? JSON.stringify(fields[c]) : fields[c]))
  };
}

const PLAYER_SELECT = `
  SELECT p.*, u.username, u.token_type
  FROM players p
  JOIN users u ON p.user_id = u.id`;

async function getGame(db = pool) {
  const result = await db.query('SELECT * FROM game WHERE id = 1');
  return result.rows[0];
}

async function lockGame(db) {
  const result = await db.query('SELECT * FROM game WHERE id = 1 FOR UPDATE');
  return result.rows[0];
}

async function updateGame(db = pool, fields) {
  const { sql, values } = setClause(fields, GAME_COLUMNS, 1);
  if (!sql) return getGame(db);
  const result = await db.query(`UPDATE game SET ${sql} WHERE id = 1 RETURNING *`, values);
  return result.rows[0];
}

async function bumpVersion(db) {
  const result = await db.query('UPDATE game SET version = version + 1 WHERE id = 1 RETURNING version');
  return result.rows[0].version;
}

async function getAllPlayers(db = pool) {
  const result = await db.query(`${PLAYER_SELECT} ORDER BY p.turn_order`);
  return result.rows;
}

async function getPlayerByUserId(db = pool, userId) {
  const result = await db.query(`${PLAYER_SELECT} WHERE p.user_id = $1`, [userId]);
  return result.rows[0];
}

async function getPlayerById(db = pool, playerId) {
  const result = await db.query(`${PLAYER_SELECT} WHERE p.id = $1`, [playerId]);
  return result.rows[0];
}

async function createPlayer(db = pool, { userId, turnOrder, color, money }) {
  const result = await db.query(
    `INSERT INTO players (user_id, turn_order, player_color, money) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, turnOrder, color, money]
  );
  return getPlayerById(db, result.rows[0].id);
}

async function updatePlayer(db = pool, playerId, fields) {
  const { sql, values } = setClause(fields, PLAYER_COLUMNS, 2);
  if (sql) {
    await db.query(`UPDATE players SET ${sql}, last_active = CURRENT_TIMESTAMP WHERE id = $1`, [playerId, ...values]);
  }
  return getPlayerById(db, playerId);
}

// Relative money change, so concurrent writers never overwrite each other with stale balances.
async function addMoney(db = pool, playerId, delta) {
  await db.query('UPDATE players SET money = money + $2, last_active = CURRENT_TIMESTAMP WHERE id = $1', [playerId, delta]);
  return getPlayerById(db, playerId);
}

async function getAllProperties(db = pool) {
  const result = await db.query('SELECT * FROM properties ORDER BY position_on_board');
  return result.rows;
}

async function getPropertyById(db = pool, propertyId) {
  const result = await db.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
  return result.rows[0];
}

async function getPropertyByPosition(db = pool, position) {
  const result = await db.query('SELECT * FROM properties WHERE position_on_board = $1', [position]);
  return result.rows[0];
}

async function updateProperty(db = pool, propertyId, fields) {
  const { sql, values } = setClause(fields, PROPERTY_COLUMNS, 2);
  if (!sql) return getPropertyById(db, propertyId);
  const result = await db.query(`UPDATE properties SET ${sql} WHERE id = $1 RETURNING *`, [propertyId, ...values]);
  return result.rows[0];
}

async function insertAction(db = pool, playerId, actionType, actionData) {
  const result = await db.query(
    'INSERT INTO game_actions (player_id, action_type, action_data) VALUES ($1, $2, $3) RETURNING *',
    [playerId, actionType, JSON.stringify(actionData)]
  );
  return result.rows[0];
}

// Persisted event log, oldest first.
async function getActions(db = pool, { limit = 100, before = null } = {}) {
  const result = await db.query(
    `SELECT a.id, a.action_type, a.action_data, a.timestamp, a.player_id, p.user_id, u.username
     FROM game_actions a
     LEFT JOIN players p ON a.player_id = p.id
     LEFT JOIN users u ON p.user_id = u.id
     WHERE ($2::int IS NULL OR a.id < $2)
     ORDER BY a.id DESC
     LIMIT $1`,
    [limit, before]
  );
  return result.rows.reverse();
}

async function getChatMessages(db = pool, limit = 100) {
  const result = await db.query(
    `SELECT c.*, u.username
     FROM game_chat c
     JOIN users u ON c.user_id = u.id
     ORDER BY c.timestamp DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.reverse();
}

async function createChatMessage(db = pool, userId, message) {
  const result = await db.query(
    'INSERT INTO game_chat (user_id, message) VALUES ($1, $2) RETURNING *',
    [userId, message]
  );
  return result.rows[0];
}

module.exports = {
  getGame,
  lockGame,
  updateGame,
  bumpVersion,
  getAllPlayers,
  getPlayerByUserId,
  getPlayerById,
  createPlayer,
  updatePlayer,
  addMoney,
  getAllProperties,
  getPropertyById,
  getPropertyByPosition,
  updateProperty,
  insertAction,
  getActions,
  getChatMessages,
  createChatMessage
};
