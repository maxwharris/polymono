const pool = require('../db');

/**
 * Create a new trade offer
 */
async function createTrade({
  proposerId,
  recipientId,
  offeredProperties = [],
  offeredMoney = 0,
  offeredJailCards = 0,
  requestedProperties = [],
  requestedMoney = 0,
  requestedJailCards = 0
}) {
  const result = await pool.query(
    `INSERT INTO trades (
      proposer_id,
      recipient_id,
      offered_properties,
      offered_money,
      offered_jail_cards,
      requested_properties,
      requested_money,
      requested_jail_cards,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *`,
    [
      proposerId,
      recipientId,
      JSON.stringify(offeredProperties),
      offeredMoney,
      offeredJailCards,
      JSON.stringify(requestedProperties),
      requestedMoney,
      requestedJailCards
    ]
  );

  return result.rows[0];
}

/**
 * Get all active trades for a player (both sent and received)
 */
async function getPlayerTrades(playerId) {
  const result = await pool.query(
    `SELECT
      t.*,
      p1.user_id as proposer_user_id,
      u1.username as proposer_username,
      p2.user_id as recipient_user_id,
      u2.username as recipient_username
    FROM trades t
    JOIN players p1 ON t.proposer_id = p1.id
    JOIN users u1 ON p1.user_id = u1.id
    JOIN players p2 ON t.recipient_id = p2.id
    JOIN users u2 ON p2.user_id = u2.id
    WHERE (t.proposer_id = $1 OR t.recipient_id = $1)
      AND t.status IN ('pending', 'countered')
    ORDER BY t.created_at DESC`,
    [playerId]
  );

  return result.rows;
}

/**
 * Get a specific trade by ID
 */
async function getTradeById(tradeId) {
  const result = await pool.query(
    `SELECT
      t.*,
      p1.user_id as proposer_user_id,
      u1.username as proposer_username,
      p2.user_id as recipient_user_id,
      u2.username as recipient_username
    FROM trades t
    JOIN players p1 ON t.proposer_id = p1.id
    JOIN users u1 ON p1.user_id = u1.id
    JOIN players p2 ON t.recipient_id = p2.id
    JOIN users u2 ON p2.user_id = u2.id
    WHERE t.id = $1`,
    [tradeId]
  );

  return result.rows[0];
}

/**
 * Update trade status
 */
async function updateTradeStatus(tradeId, status) {
  const result = await pool.query(
    `UPDATE trades
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *`,
    [status, tradeId]
  );

  return result.rows[0];
}

/**
 * Counter a trade offer with new terms
 */
async function counterTrade(tradeId, {
  offeredProperties,
  offeredMoney,
  offeredJailCards,
  requestedProperties,
  requestedMoney,
  requestedJailCards
}) {
  const result = await pool.query(
    `UPDATE trades
    SET
      offered_properties = $1,
      offered_money = $2,
      offered_jail_cards = $3,
      requested_properties = $4,
      requested_money = $5,
      requested_jail_cards = $6,
      status = 'countered',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *`,
    [
      JSON.stringify(offeredProperties),
      offeredMoney,
      offeredJailCards,
      JSON.stringify(requestedProperties),
      requestedMoney,
      requestedJailCards,
      tradeId
    ]
  );

  return result.rows[0];
}

/**
 * Delete/cancel a trade
 */
async function deleteTrade(tradeId) {
  await pool.query('DELETE FROM trades WHERE id = $1', [tradeId]);
}

module.exports = {
  createTrade,
  getPlayerTrades,
  getTradeById,
  updateTradeStatus,
  counterTrade,
  deleteTrade
};
