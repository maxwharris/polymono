const express = require('express');
const { authenticateToken, requirePlayer } = require('../middleware/auth');
const pool = require('../db');
const { getPlayerByUserId } = require('../db/queries');
const { getPlayerTrades } = require('../db/tradeQueries');
const { action } = require('./game');

const router = express.Router();

router.use(authenticateToken, requirePlayer);

const game = req => req.app.gameController;
const tradeId = req => Number(req.params.id);

// GET /api/trade - { active, history } for the current player. No side effects.
router.get('/', action(async req => {
  const player = await getPlayerByUserId(pool, req.user.id);
  if (!player) return { active: [], history: [] };
  return getPlayerTrades(pool, player.id);
}));

router.post('/', action(req => game(req).proposeTrade(req.user.id, req.body || {})));
router.post('/:id/accept', action(req => game(req).acceptTrade(req.user.id, tradeId(req))));
router.post('/:id/reject', action(req => game(req).rejectTrade(req.user.id, tradeId(req))));
router.post('/:id/counter', action(req => game(req).counterTrade(req.user.id, tradeId(req), req.body || {})));
router.delete('/:id', action(req => game(req).cancelTrade(req.user.id, tradeId(req))));

module.exports = router;
