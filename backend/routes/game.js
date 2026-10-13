const express = require('express');
const { authenticateToken, requirePlayer } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Runs a controller action and maps rule violations (GameError) to their status code.
function action(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error(`${req.method} ${req.originalUrl} failed:`, error);
      res.status(500).json({ message: 'Server error' });
    }
  };
}

const game = req => req.app.gameController;

// GET /api/game - full game state
router.get('/', action(req => game(req).getState()));

// GET /api/game/log?limit=100&before=<id> - persisted event log, oldest first
router.get('/log', action(req => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const before = Number(req.query.before);
  return game(req).getLog({ limit, before: Number.isInteger(before) && before > 0 && before <= 2147483647 ? before : null });
}));

router.use(requirePlayer);

// Turn
router.post('/roll', action(req => game(req).roll(req.user.id)));
router.post('/buy', action(req => game(req).buy(req.user.id)));
router.post('/decline', action(req => game(req).decline(req.user.id)));
router.post('/pay-fine', action(req => game(req).payFine(req.user.id)));
router.post('/use-card', action(req => game(req).useJailCard(req.user.id)));
router.post('/pay-debts', action(req => game(req).payDebts(req.user.id)));
router.post('/bankrupt', action(req => game(req).bankrupt(req.user.id)));
router.post('/end-turn', action(req => game(req).endTurn(req.user.id)));

// Property management
for (const [route, name] of [['build', 'build'], ['sell-building', 'sell'], ['mortgage', 'mortgage'], ['unmortgage', 'unmortgage']]) {
  router.post(`/${route}`, action(req => game(req).manage(req.user.id, req.body?.propertyId, name)));
}

// Lobby
router.post('/join', action(req => game(req).join(req.user.id)));
router.post('/ready', action(req => game(req).toggleReady(req.user.id)));
router.post('/leave', action(req => game(req).leave(req.user.id)));
router.post('/start', action(req => game(req).start(req.user.id)));
router.post('/remove-player', action(req => game(req).removePlayer(req.user.id, req.body?.playerId)));
router.post('/new', action(req => game(req).newGame(req.user)));

module.exports = router;
module.exports.action = action;
