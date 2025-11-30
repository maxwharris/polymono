const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// All routes require authentication
router.use(authenticateToken);

// GET /api/game - Get full game state
router.get('/', async (req, res) => {
  try {
    const gameState = await req.app.gameController.getFullGameState();
    res.json(gameState);
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/game/roll - Roll dice
router.post('/roll', async (req, res) => {
  try {
    const result = await req.app.gameController.handleRollDice(req.user.id);

    // Broadcast to all clients with player info
    if (req.app.io) {
      req.app.io.emit('game:dice_rolled', {
        ...result,
        user_id: req.user.id
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Roll dice error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/game/buy-property - Buy current property
router.post('/buy-property', async (req, res) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID required' });
    }

    const result = await req.app.gameController.handleBuyProperty(
      req.user.id,
      propertyId
    );

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('game:property_purchased', result);
    }

    res.json(result);
  } catch (error) {
    console.error('Buy property error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/game/buy-houses - Buy houses/hotel for a property
router.post('/buy-houses', async (req, res) => {
  try {
    const { propertyId, count } = req.body;

    if (!propertyId || !count) {
      return res.status(400).json({ message: 'Property ID and count required' });
    }

    if (count < 1 || count > 5) {
      return res.status(400).json({ message: 'Count must be between 1 and 5' });
    }

    const result = await req.app.gameController.handleBuyHouses(
      req.user.id,
      propertyId,
      count
    );

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('game:houses_purchased', result);
    }

    res.json(result);
  } catch (error) {
    console.error('Buy houses error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/game/end-turn - End current turn
router.post('/end-turn', async (req, res) => {
  try {
    const result = await req.app.gameController.handleEndTurn(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('End turn error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/game/join - Join game as a player
router.post('/join', async (req, res) => {
  try {
    const { createPlayer, getAllPlayers, getGame, updateGame } = require('../db/queries');

    // Check game status
    const game = await getGame();
    if (game.status === 'in_progress') {
      return res.status(400).json({ message: 'Cannot join game in progress' });
    }

    // Check if player already exists
    const existingPlayers = await getAllPlayers();
    const playerExists = existingPlayers.find(p => p.user_id === req.user.id);

    if (playerExists) {
      return res.json({
        message: 'Already in game',
        player: playerExists
      });
    }

    // Create new player with next turn order
    const turnOrder = existingPlayers.length + 1;
    const player = await createPlayer(req.user.id, turnOrder);

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('player:joined', { player });
    }

    res.json({
      message: 'Joined game successfully',
      player
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/game/ready - Toggle ready status in lobby
router.post('/ready', async (req, res) => {
  try {
    const pool = require('../db');
    const { getPlayerByUserId, getAllPlayers } = require('../db/queries');

    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Toggle ready status
    const newReadyStatus = !player.ready_to_start;
    await pool.query(
      'UPDATE players SET ready_to_start = $1 WHERE id = $2',
      [newReadyStatus, player.id]
    );

    // Broadcast updated players
    if (req.app.io) {
      const updatedPlayers = await getAllPlayers();
      req.app.io.emit('lobby:player_ready', {
        player_id: player.id,
        ready: newReadyStatus,
        players: updatedPlayers
      });
    }

    res.json({ ready: newReadyStatus });
  } catch (error) {
    console.error('Toggle ready error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/game/start - Start the game from lobby
router.post('/start', async (req, res) => {
  try {
    const pool = require('../db');
    const { getGame, getAllPlayers, updateGame } = require('../db/queries');

    const game = await getGame();
    if (game.status !== 'lobby') {
      return res.status(400).json({ message: 'Game is not in lobby' });
    }

    const players = await getAllPlayers();

    // Check minimum players
    if (players.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 players to start' });
    }

    // Check all players are ready
    const allReady = players.every(p => p.ready_to_start);
    if (!allReady) {
      return res.status(400).json({ message: 'Not all players are ready' });
    }

    // Start the game
    await pool.query(`
      UPDATE game SET
        status = 'in_progress',
        started_at = CURRENT_TIMESTAMP,
        current_turn_user_id = (SELECT user_id FROM players ORDER BY turn_order LIMIT 1)
      WHERE id = 1
    `);

    // Broadcast game started
    if (req.app.io) {
      req.app.io.emit('game:started', { message: 'Game has started!' });
    }

    res.json({ message: 'Game started' });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/game/leave - Leave the lobby
router.post('/leave', async (req, res) => {
  try {
    const pool = require('../db');
    const { getGame, getPlayerByUserId, getAllPlayers } = require('../db/queries');

    const game = await getGame();
    if (game.status !== 'lobby') {
      return res.status(400).json({ message: 'Cannot leave game in progress' });
    }

    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Delete the player
    await pool.query('DELETE FROM players WHERE id = $1', [player.id]);

    // Reorder remaining players' turn order
    const remainingPlayers = await getAllPlayers();
    for (let i = 0; i < remainingPlayers.length; i++) {
      await pool.query(
        'UPDATE players SET turn_order = $1 WHERE id = $2',
        [i + 1, remainingPlayers[i].id]
      );
    }

    // Broadcast player left
    if (req.app.io) {
      const updatedPlayers = await getAllPlayers();
      req.app.io.emit('lobby:player_left', {
        user_id: req.user.id,
        username: req.user.username,
        players: updatedPlayers
      });
    }

    res.json({ message: 'Left lobby successfully' });
  } catch (error) {
    console.error('Leave lobby error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/game/remove-player - Remove a player from lobby (host only)
router.post('/remove-player', async (req, res) => {
  try {
    const pool = require('../db');
    const { getGame, getAllPlayers } = require('../db/queries');

    const game = await getGame();
    if (game.status !== 'lobby') {
      return res.status(400).json({ message: 'Can only remove players in lobby' });
    }

    const { playerId } = req.body;
    if (!playerId) {
      return res.status(400).json({ message: 'Player ID required' });
    }

    const players = await getAllPlayers();

    // Check if requester is the host (first player who joined)
    const hostPlayer = players.sort((a, b) => a.turn_order - b.turn_order)[0];
    if (hostPlayer.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can remove players' });
    }

    // Get player to remove
    const playerToRemove = players.find(p => p.id === playerId);
    if (!playerToRemove) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Cannot remove yourself
    if (playerToRemove.user_id === req.user.id) {
      return res.status(400).json({ message: 'Cannot remove yourself. Use leave instead.' });
    }

    // Delete the player
    await pool.query('DELETE FROM players WHERE id = $1', [playerId]);

    // Reorder remaining players' turn order
    const remainingPlayers = await getAllPlayers();
    for (let i = 0; i < remainingPlayers.length; i++) {
      await pool.query(
        'UPDATE players SET turn_order = $1 WHERE id = $2',
        [i + 1, remainingPlayers[i].id]
      );
    }

    // Broadcast player removed
    if (req.app.io) {
      const updatedPlayers = await getAllPlayers();
      req.app.io.emit('lobby:player_removed', {
        removed_player_id: playerId,
        removed_player_username: playerToRemove.username,
        players: updatedPlayers
      });
    }

    res.json({ message: 'Player removed successfully' });
  } catch (error) {
    console.error('Remove player error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
