/**
 * Reset the game: back to the lobby with every player's seat kept, all properties returned to the bank,
 * trades and the event log cleared. Chat is kept.
 *
 * Asks the running server to do it (so connected clients update at once), signing a short-lived admin
 * token with JWT_SECRET from .env. Usage on the box: node scripts/resetGame.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const pool = require('../db');

async function resetGame() {
  const adminName = (process.env.ADMIN_USERS || '').split(',')[0].trim();
  if (!adminName) throw new Error('Set ADMIN_USERS in backend/.env');
  const result = await pool.query('SELECT id, username, token_version FROM users WHERE LOWER(username) = LOWER($1)', [adminName]);
  await pool.end();
  const admin = result.rows[0];
  if (!admin) throw new Error(`Admin user "${adminName}" not found`);

  const token = jwt.sign({ id: admin.id, username: admin.username, tv: admin.token_version }, process.env.JWT_SECRET, { expiresIn: '1m' });
  const port = process.env.PORT || 3002;
  const response = await fetch(`http://localhost:${port}/api/admin/reset-game`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Server answered ${response.status}`);
  console.log('Game reset: everyone is back in the lobby.');
}

resetGame().catch(error => {
  console.error('Reset failed:', error.message);
  console.error('Is the server running? (pm2 status monop-backend)');
  process.exit(1);
});
