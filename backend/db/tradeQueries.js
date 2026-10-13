const pool = require('../db');

const TRADE_SELECT = `
  SELECT
    t.*,
    p1.user_id AS proposer_user_id,
    u1.username AS proposer_username,
    p2.user_id AS recipient_user_id,
    u2.username AS recipient_username
  FROM trades t
  JOIN players p1 ON t.proposer_id = p1.id
  JOIN users u1 ON p1.user_id = u1.id
  JOIN players p2 ON t.recipient_id = p2.id
  JOIN users u2 ON p2.user_id = u2.id`;

async function createTrade(db = pool, { proposerId, recipientId, terms, counteredFrom = null }) {
  const result = await db.query(
    `INSERT INTO trades (proposer_id, recipient_id, offered_properties, offered_money, offered_jail_cards,
       requested_properties, requested_money, requested_jail_cards, countered_from, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING id`,
    [
      proposerId,
      recipientId,
      JSON.stringify(terms.offeredProperties),
      terms.offeredMoney,
      terms.offeredJailCards,
      JSON.stringify(terms.requestedProperties),
      terms.requestedMoney,
      terms.requestedJailCards,
      counteredFrom
    ]
  );
  return getTradeById(db, result.rows[0].id);
}

async function getTradeById(db = pool, tradeId) {
  const result = await db.query(`${TRADE_SELECT} WHERE t.id = $1`, [tradeId]);
  return result.rows[0];
}

async function getPendingTrades(db) {
  const result = await db.query(`${TRADE_SELECT} WHERE t.status = 'pending' ORDER BY t.created_at`);
  return result.rows;
}

// Pending trades involving the player, and their 20 most recent closed ones.
async function getPlayerTrades(db = pool, playerId) {
  const active = await db.query(
    `${TRADE_SELECT} WHERE (t.proposer_id = $1 OR t.recipient_id = $1) AND t.status = 'pending' ORDER BY t.created_at DESC`,
    [playerId]
  );
  const history = await db.query(
    `${TRADE_SELECT} WHERE (t.proposer_id = $1 OR t.recipient_id = $1) AND t.status <> 'pending'
     ORDER BY t.updated_at DESC LIMIT 20`,
    [playerId]
  );
  return { active: active.rows, history: history.rows };
}

async function setTradeStatus(db = pool, tradeId, status) {
  await db.query('UPDATE trades SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, tradeId]);
  return getTradeById(db, tradeId);
}

async function cancelTradesForPlayer(db = pool, playerId) {
  const result = await db.query(
    `UPDATE trades SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'pending' AND (proposer_id = $1 OR recipient_id = $1)
     RETURNING id`,
    [playerId]
  );
  return result.rows.map(r => r.id);
}

module.exports = {
  createTrade,
  getTradeById,
  getPendingTrades,
  getPlayerTrades,
  setTradeStatus,
  cancelTradesForPlayer
};
