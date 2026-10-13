const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { TOKEN_TYPES } = require('../game/board');
const { authenticateToken, requireAdmin, isAdmin, signUserToken, signSpectatorToken, userFromToken } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    tokenType: user.token_type,
    isAdmin: isAdmin(user)
  };
}

// Slows down password guessing: 10 failed logins per address and username per 15 minutes. Keyed by address
// too, so a stranger can't lock a player out of their own account.
const failedLogins = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;

setInterval(() => {
  for (const [key, entry] of failedLogins) {
    if (Date.now() - entry.first > LOGIN_WINDOW_MS) failedLogins.delete(key);
  }
}, LOGIN_WINDOW_MS).unref();

function loginBlocked(key) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) return false;
  return entry.count >= MAX_FAILED_LOGINS;
}

function recordFailedLogin(key) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    failedLogins.set(key, { first: Date.now(), count: 1 });
  } else {
    entry.count++;
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  const name = username.trim().toLowerCase();
  const key = `${req.ip}|${name}`;
  if (loginBlocked(key)) {
    return res.status(429).json({ message: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  try {
    // Phones capitalise the first letter, so usernames match case-insensitively.
    const result = await pool.query(
      'SELECT id, username, password_hash, token_type, token_version FROM users WHERE LOWER(username) = $1',
      [name]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      recordFailedLogin(key);
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    failedLogins.delete(key);

    res.json({ token: signUserToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.post('/spectate', (req, res) => {
  res.json({
    token: signSpectatorToken(),
    user: { id: 0, username: 'Spectator', tokenType: 'spectator', isSpectator: true, isAdmin: false }
  });
});

router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  let user;
  try {
    user = await userFromToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  if (user.isSpectator) {
    return res.json({ valid: true, user: { id: 0, username: 'Spectator', tokenType: 'spectator', isSpectator: true, isAdmin: false } });
  }
  res.json({ valid: true, user: publicUser({ id: user.id, username: user.username, token_type: user.tokenType }) });
});

function validPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 200;
}

// POST /api/auth/password - change your own password. Every other session is logged out; this one gets
// a fresh token.
router.post('/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (req.user.isSpectator) return res.status(403).json({ message: 'Spectators have no password' });
  if (!validPassword(newPassword)) return res.status(400).json({ message: 'The new password needs at least 6 characters' });
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ message: 'Your current password is wrong' });
    }
    const updated = await pool.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING id, username, token_version',
      [await bcrypt.hash(newPassword, 10), req.user.id]
    );
    res.json({ message: 'Password changed', token: signUserToken(updated.rows[0]) });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- admin: user management ----------------------------------------------------------------------------

router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, tokenType } = req.body || {};
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{2,30}$/.test(username.trim())) {
    return res.status(400).json({ message: 'Usernames are 2-30 letters, numbers, dots, dashes or underscores' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ message: 'Passwords need at least 6 characters' });
  }
  if (!TOKEN_TYPES.includes(tokenType)) {
    return res.status(400).json({ message: `Token must be one of: ${TOKEN_TYPES.join(', ')}` });
  }
  try {
    const taken = await pool.query(
      'SELECT LOWER(username) = LOWER($1) AS same_name FROM users WHERE LOWER(username) = LOWER($1) OR token_type = $2',
      [username.trim(), tokenType]
    );
    if (taken.rows.length) {
      const message = taken.rows.some(r => r.same_name) ? 'Username already exists' : 'Token already taken';
      return res.status(400).json({ message });
    }
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, token_type) VALUES ($1, $2, $3) RETURNING id, username, token_type',
      [username.trim(), await bcrypt.hash(password, 10), tokenType]
    );
    res.status(201).json({ message: 'User created successfully', user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.token_type, u.created_at, (p.id IS NOT NULL) AS in_game
       FROM users u LEFT JOIN players p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2147483647) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete yourself' });
  }
  try {
    const user = (await pool.query('SELECT id, username FROM users WHERE id = $1', [userId])).rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const player = (await pool.query('SELECT id FROM players WHERE user_id = $1', [userId])).rows[0];
    if (player) {
      return res.status(409).json({ message: `${user.username} is in the current game. Remove them from the lobby or start a new game first.` });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'User deleted successfully', username: user.username });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.validPassword = validPassword;
