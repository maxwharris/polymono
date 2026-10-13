// A throwaway Postgres 16 cluster for the tests: embedded-postgres ships real Postgres binaries through npm
// (no Docker, no Homebrew). It lives in a temp dir on a free port and is deleted by stop().
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const APP_USER = 'polyuser';

async function startCluster() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polymono-test-'));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  const port = await freePort();
  const password = crypto.randomBytes(12).toString('hex');
  const appPassword = crypto.randomBytes(12).toString('hex');
  const logs = [];
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, 'pg'),
    port,
    user: 'postgres',
    password,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--no-sync'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off'],
    onLog: (m) => logs.push(String(m)),
    onError: (m) => logs.push(String(m)),
  });
  try {
    await pg.initialise();
    await pg.start();
  } catch (err) {
    console.error(logs.join(''));
    throw err;
  }

  const connect = async (database, user = APP_USER) => {
    const client = new Client({ host: '127.0.0.1', port, database, user, password: user === APP_USER ? appPassword : password });
    client.on('error', () => {}); // a client still open when the cluster stops must not crash the run
    await client.connect();
    return client;
  };

  // The app connects as an ordinary role that owns its database, like the box.
  const admin = await connect('postgres', 'postgres');
  await admin.query(`CREATE ROLE ${APP_USER} LOGIN PASSWORD '${appPassword}'`);

  return {
    dir,
    port,
    logs,
    connect,
    /** DB_* settings for the app user on `database`, as in backend/.env. */
    env: (database) => ({ DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: database, DB_USER: APP_USER, DB_PASSWORD: appPassword }),
    createDatabase: (name) => admin.query(`CREATE DATABASE ${name} OWNER ${APP_USER}`),
    async stop() {
      await admin.end().catch(() => {});
      await pg.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

module.exports = { startCluster, freePort };
