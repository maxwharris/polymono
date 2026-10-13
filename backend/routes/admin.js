const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validPassword } = require('./auth');
const { action } = require('./game');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

// POST /api/admin/users/:id/password - set someone's password
router.post('/users/:id/password', async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2147483647) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  if (!validPassword(req.body?.newPassword)) {
    return res.status(400).json({ message: 'Passwords need at least 6 characters' });
  }
  try {
    const result = await pool.query('UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING username',
      [await bcrypt.hash(req.body.newPassword, 10), userId]);
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `Password changed for ${result.rows[0].username}` });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/reset-game - back to the lobby, keeping everyone's seat
router.post('/reset-game', action(req => req.app.gameController.newGame(req.user, { admin: true })));

// PATCH /api/admin/settings { turn_hours }
router.patch('/settings', action(req => req.app.gameController.updateSettings(req.body || {})));

module.exports = router;
