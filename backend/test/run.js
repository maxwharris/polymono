#!/usr/bin/env node
// npm test. Starts a throwaway Postgres 16 (test/postgres.js), tests the migrations runner, then builds a game
// database the way a fresh install does (schema.sql, scripts/migrate.js, scripts/seedProperties.js) and runs
// the game scenarios against the real server, in-process on a random port with scripted dice.
// Needs no database, .env or network; everything lives in a temp dir that is deleted afterwards.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startCluster } = require('./postgres');
const checks = require('./check');
const { migrate } = require('../scripts/migrate');
const seedProperties = require('../scripts/seedProperties');

const TIMEOUT_MS = 3 * 60 * 1000;
process.env.DOTENV_CONFIG_QUIET = 'true';

/** Replaces the dice with a queue the scenarios fill: push [die1, die2]; an empty queue rolls randomly. */
function scriptDice() {
  const dice = require('../game/mechanics/dice');
  const queue = [];
  const die = () => 1 + Math.floor(Math.random() * 6);
  dice.rollDice = () => {
    const [a, b] = queue.length ? queue.shift() : [die(), die()];
    return { die1: a, die2: b, total: a + b, isDoubles: a === b };
  };
  return queue;
}

async function main() {
  const cluster = await startCluster();
  let app = null;
  const watchdog = setTimeout(async () => {
    console.error(`\nTimed out after ${TIMEOUT_MS / 1000}s`);
    await cluster.stop().catch(() => {});
    process.exit(2);
  }, TIMEOUT_MS);
  watchdog.unref();

  try {
    checks.startSuite('migrations');
    await require('./migrations').run(cluster);

    checks.startSuite('scenarios');
    await cluster.createDatabase('polymono');
    const db = await cluster.connect('polymono');
    await db.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
    await migrate(db, { log: () => {} });
    await seedProperties(db, () => {});
    await db.end();

    Object.assign(process.env, cluster.env('polymono'), {
      JWT_SECRET: crypto.randomBytes(24).toString('hex'),
      ADMIN_USERS: 'max',
      PORT: '0', // any free port
    });
    process.chdir(cluster.dir); // the app's dotenv must not pick up a developer's backend/.env
    const rolls = scriptDice(); // before the server loads: the game code takes rollDice when it is required
    let server;
    ({ app, server } = require('../index.js'));
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    clearInterval(app.gameController.timer); // the scenarios run the turn timer themselves
    await require('./scenarios').run({
      base: `http://127.0.0.1:${server.address().port}`,
      pool: require('../db'),
      rolls,
      gameController: app.gameController,
    });
  } finally {
    if (app) {
      clearInterval(app.gameController.timer);
      await new Promise(resolve => app.io.close(() => resolve()));
      await require('../db').end().catch(() => {});
    }
    await cluster.stop();
  }
  return checks.summary();
}

main().then(failed => process.exit(failed ? 1 : 0), err => {
  console.error('\nTEST RUN ERROR', err);
  checks.summary();
  process.exit(2);
});
