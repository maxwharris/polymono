const jwt = require('jsonwebtoken');
const pool = require('../db');

const TOKEN_TTL = '30d'; // games run for days; a 24h token logged players out mid-game

// Admins are listed by username in ADMIN_USERS; with none configured, nobody is an admin. Usernames are
// unique case-insensitively (users_username_lower_key) and read from the database, never from the token.
function adminUsernames() {
  return (process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isAdmin(user) {
  return !!user && !user.isSpectator && adminUsernames().includes(String(user.username).toLowerCase());
}

// `user` is a users row. The token carries its token_version, so changing a password (or deleting the
// account) invalidates every token issued before.
function signUserToken(user) {
  return jwt.sign({ id: user.id, username: user.username, tv: user.token_version ?? 0 }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function signSpectatorToken() {
  return jwt.sign({ id: 0, username: 'Spectator', isSpectator: true }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * Verifies a token and returns who it belongs to now: { id, username, tokenType, isSpectator }. Throws if
 * the token is invalid, expired, or revoked. Usernames come from the database, never from the token.
 */
async function userFromToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.isSpectator) {
    return { id: 0, username: 'Spectator', tokenType: 'spectator', isSpectator: true };
  }
  const result = await pool.query('SELECT id, username, token_type, token_version FROM users WHERE id = $1', [decoded.id]);
  const user = result.rows[0];
  if (!user || user.token_version !== decoded.tv) {
    throw new Error('Token revoked');
  }
  return { id: user.id, username: user.username, tokenType: user.token_type, isSpectator: false };
}

async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    req.user = await userFromToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  next();
}

// Spectator tokens (id 0) can read but never write.
function requirePlayer(req, res, next) {
  if (!req.user || req.user.isSpectator || !Number.isInteger(req.user.id) || req.user.id <= 0) {
    return res.status(403).json({ message: 'Spectators cannot do that' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
}

module.exports = { authenticateToken, requirePlayer, requireAdmin, isAdmin, signUserToken, signSpectatorToken, userFromToken };
