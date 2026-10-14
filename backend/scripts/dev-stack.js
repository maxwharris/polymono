/**
 * A throwaway local stack for development and UI checks: an embedded Postgres in a temp dir with the schema,
 * migrations, the six seed accounts (password = username) and the properties, then the API server.
 * Nothing touches backend/.env or a real database. Ctrl-C (or SIGTERM) stops it and deletes the data.
 *
 *   node scripts/dev-stack.js --api-port 3200 [--game] [--players 6]
 *     --game       start a game in progress with the first N seed players (default: an empty lobby)
 *   then, in frontend/:  BACKEND_URL=http://localhost:3200 VITE_BACKEND_URL=http://localhost:3200 npx vite --port 5200
 *   (the API only allows browser origins it knows: add yours with CORS_ORIGINS=http://localhost:5200)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startCluster } = require('../test/postgres');
const { migrate } = require('./migrate');
const seedProperties = require('./seedProperties');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const apiPort = Number(arg('api-port', '3200'));
  const startGame = process.argv.includes('--game');
  const playerCount = Math.min(6, Math.max(2, Number(arg('players', '6'))));

  const cluster = await startCluster();
  const stop = async () => {
    await cluster.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await cluster.createDatabase('polymono');
  const db = await cluster.connect('polymono');
  await db.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  await migrate(db, { log: () => {} });
  await seedProperties(db, () => {});
  if (startGame) {
    const users = (await db.query('SELECT id FROM users ORDER BY id LIMIT $1', [playerCount])).rows;
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    for (const [i, u] of users.entries()) {
      await db.query('INSERT INTO players (user_id, turn_order, player_color, ready_to_start) VALUES ($1, $2, $3, true)', [u.id, i + 1, colors[i]]);
    }
  }
  await db.end();

  Object.assign(process.env, cluster.env('polymono'), {
    JWT_SECRET: crypto.randomBytes(24).toString('hex'),
    ADMIN_USERS: 'max',
    PORT: String(apiPort),
    NTFY_BASE: 'http://127.0.0.1:9', // never send real phone alerts from a dev stack
  });
  process.chdir(cluster.dir); // a developer's backend/.env must not leak in
  const { app } = require('../index.js');

  if (startGame) {
    // Start through the engine so decks, deadlines and the first turn are set up like a real game.
    const max = (await require('../db').query("SELECT id FROM users WHERE username = 'max'")).rows[0];
    await new Promise(r => setTimeout(r, 300));
    await app.gameController.start(max.id);
  }
  console.log(`dev stack ready: API http://localhost:${apiPort} (${startGame ? 'game in progress' : 'empty lobby'}); accounts max/max, jack/jack, youngeun/youngeun, seabass/seabass, jason/jason, raymond/raymond`);
}

main().catch(err => {
  console.error('dev stack failed:', err);
  process.exit(1);
});
