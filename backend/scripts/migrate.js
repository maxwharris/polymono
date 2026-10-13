#!/usr/bin/env node
/**
 * Database migrations. Run from anywhere; connects with DB_* from backend/.env.
 *
 *   node scripts/migrate.js                      apply every pending migration (deploy.sh runs this)
 *   node scripts/migrate.js --status             list applied and pending migrations; changes nothing
 *   node scripts/migrate.js --baseline <name>    record every migration up to and including <name> as applied
 *                                                WITHOUT running it (a database migrated by hand before this
 *                                                runner existed: the live box is `--baseline 003_game_engine`)
 *   node scripts/migrate.js --assume-none-applied
 *                                                the database has tables but no history and is the ORIGINAL
 *                                                schema with no migration applied: run them all (tests use this)
 *
 * Exits non-zero on any failure; deploy.sh then stops before restarting the backend.
 *
 * Rules
 * - A migration is migrations/NNN_short_name.sql, NNN the next free 3-digit number. Pending files run in NNN
 *   order, each in its own transaction together with its schema_migrations row, so a file applies completely
 *   or not at all. No BEGIN/COMMIT inside a file, and nothing that can't run in a transaction
 *   (CREATE INDEX CONCURRENTLY, VACUUM).
 * - Never edit a migration once it has been deployed: its sha256 is recorded and the runner refuses to run
 *   while an applied file differs. Fix forward with a new file.
 * - The running backend keeps serving the old code while migrations run (and if one fails), so keep them
 *   compatible with it: add columns with defaults now, drop old ones in a later release.
 * - schema.sql builds a fresh database and ends by recording the migrations it already contains (rules at its
 *   top). A migration is recorded there only if schema.sql includes its changes; otherwise the runner applies
 *   it to fresh databases too. npm test checks both paths end in the same schema.
 * - A database with tables but no schema_migrations is refused (it could be a live one whose migrations were
 *   applied by hand, and 001 empties the players table): baseline it, or pass --assume-none-applied.
 * - Concurrent runs wait for each other (Postgres advisory lock).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_KEY = 4207150231; // any constant: every runner against this database takes the same advisory lock
const FILE_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
)`;

class MigrationError extends Error {}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** The migration files, in order: [{ name: '001_lobby_system', file, number, sql, checksum }]. */
function loadMigrations(dir = MIGRATIONS_DIR) {
  const byNumber = new Map();
  return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(file => {
    const m = FILE_RE.exec(file);
    if (!m) throw new MigrationError(`migrations/${file}: name it NNN_short_name.sql (lowercase), e.g. 004_add_x.sql`);
    if (byNumber.has(m[1])) throw new MigrationError(`migrations/${file} and ${byNumber.get(m[1])} share the number ${m[1]}: renumber one`);
    byNumber.set(m[1], file);
    const bytes = fs.readFileSync(path.join(dir, file));
    const sql = bytes.toString('utf8');
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;/im.test(sql)) {
      throw new MigrationError(`migrations/${file} manages its own transaction: remove BEGIN/COMMIT, the runner wraps each file`);
    }
    return { name: file.slice(0, -4), file, number: Number(m[1]), sql, checksum: sha256(bytes) };
  });
}

async function readApplied(client) {
  const exists = (await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS e")).rows[0].e;
  if (!exists) return { exists, applied: new Map() };
  const rows = (await client.query('SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name')).rows;
  return { exists, applied: new Map(rows.map(r => [r.name, r])) };
}

/** Throws if an applied migration's file changed or a pending one sorts before an applied one. */
function verify(migrations, applied) {
  const changed = migrations.filter(m => applied.has(m.name) && applied.get(m.name).checksum !== m.checksum);
  if (changed.length) {
    throw new MigrationError(
      `applied migration(s) changed since they ran: ${changed.map(m => m.file).join(', ')}. ` +
      'Restore the file(s) (git log -p backend/migrations) and put the change in a new migration.');
  }
  const lastApplied = Math.max(0, ...migrations.filter(m => applied.has(m.name)).map(m => m.number));
  const early = migrations.filter(m => !applied.has(m.name) && m.number < lastApplied);
  if (early.length) {
    throw new MigrationError(
      `${early.map(m => m.file).join(', ')} pending but a later-numbered migration is already applied: ` +
      'renumber it after the last applied one.');
  }
}

const hint = (err) => err.code === '42501' // insufficient_privilege
  ? '\n  hint: DB_USER must own the tables (ALTER TABLE ... OWNER TO <user>) and have CREATE on schema public'
  : '';

function describe(err, m) {
  const where = err.position ? ` (line ${m.sql.slice(0, Number(err.position) - 1).split('\n').length})` : '';
  return `${m.file} failed${where}: ${err.message}${hint(err)}\n  It was rolled back; nothing after it ran.`;
}

/**
 * Applies pending migrations (or records a baseline) on one pg client, under an advisory lock.
 * Returns { applied: [names run], baselined: [names recorded without running] }.
 */
async function migrate(client, { baseline, assumeNoneApplied = false, dir, log = console.log } = {}) {
  const migrations = loadMigrations(dir);
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    const { exists, applied } = await readApplied(client);
    verify(migrations, applied);

    if (baseline) {
      const target = migrations.find(m => m.name === baseline.replace(/\.sql$/, ''));
      if (!target) throw new MigrationError(`--baseline ${baseline}: no such migration (have ${migrations.map(m => m.name).join(', ')})`);
      const toRecord = migrations.filter(m => m.number <= target.number && !applied.has(m.name));
      await client.query(CREATE_TABLE);
      for (const m of toRecord) {
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [m.name, m.checksum]);
        log(`baselined ${m.name} (recorded as applied, not run)`);
      }
      if (!toRecord.length) log(`nothing to baseline: everything up to ${target.name} is already recorded`);
      return { applied: [], baselined: toRecord.map(m => m.name) };
    }

    if (applied.size === 0) {
      const tables = (await client.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'schema_migrations'"
      )).rows[0].n;
      if (tables === 0) throw new MigrationError('the database is empty: load schema.sql first (it records the migrations it includes)');
      if (!assumeNoneApplied) {
        throw new MigrationError(
          'the database has tables but no migration history, so it is unknown which migrations it has.\n' +
          '  Migrations applied by hand: node scripts/migrate.js --baseline <last one applied> (the live box: 003_game_engine)\n' +
          '  The original schema with none applied: node scripts/migrate.js --assume-none-applied');
      }
    }
    if (!exists) await client.query(CREATE_TABLE);

    const pending = migrations.filter(m => !applied.has(m.name));
    for (const m of pending) {
      log(`applying ${m.name}`);
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new MigrationError(describe(err, m));
      }
    }
    log(pending.length ? `applied ${pending.length} migration(s)` : 'database is up to date');
    return { applied: pending.map(m => m.name), baselined: [] };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

/** [{ name, state: 'applied' | 'pending' | 'changed' | 'no file', applied_at }], read-only. */
async function status(client, { dir } = {}) {
  const migrations = loadMigrations(dir);
  const { applied } = await readApplied(client);
  const rows = migrations.map(m => {
    const a = applied.get(m.name);
    return { name: m.name, state: !a ? 'pending' : a.checksum === m.checksum ? 'applied' : 'changed', applied_at: a?.applied_at || null };
  });
  for (const [name, a] of applied) {
    if (!migrations.some(m => m.name === name)) rows.push({ name, state: 'no file', applied_at: a.applied_at });
  }
  return rows.sort((x, y) => x.name.localeCompare(y.name));
}

/** Names of migration files not yet applied (e.g. for a health check). */
async function pendingMigrations(client, opts) {
  return (await status(client, opts)).filter(r => r.state === 'pending').map(r => r.name);
}

module.exports = { migrate, status, pendingMigrations, loadMigrations, MigrationError, MIGRATIONS_DIR };

async function main(argv) {
  const args = argv.slice(2);
  const opts = {};
  let showStatus = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status') showStatus = true;
    else if (args[i] === '--assume-none-applied') opts.assumeNoneApplied = true;
    else if (args[i] === '--baseline' && args[i + 1]) opts.baseline = args[++i];
    else throw new MigrationError(`unknown argument ${args[i]}. Usage: node scripts/migrate.js [--status | --baseline <name> | --assume-none-applied]`);
  }

  process.env.DOTENV_CONFIG_QUIET ??= 'true';
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const pool = require('../db');
  const client = await pool.connect();
  try {
    if (showStatus) {
      if (!(await readApplied(client)).exists) console.log('no schema_migrations table yet: nothing recorded (see --baseline)');
      const rows = await status(client);
      for (const r of rows) {
        const when = r.applied_at ? new Date(r.applied_at).toISOString().slice(0, 16).replace('T', ' ') : '';
        console.log(`${r.state.padEnd(8)} ${when.padEnd(16)} ${r.name}`);
      }
      if (!rows.length) console.log('no migrations');
      return rows.some(r => r.state === 'changed') ? 1 : 0;
    }
    await migrate(client, opts);
    return 0;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main(process.argv).then(code => process.exit(code), err => {
    // MigrationErrors and database errors (they carry a code) are explained by their message.
    console.error(`migrate: ${err instanceof MigrationError || err.code ? err.message + hint(err) : err.stack || err}`);
    process.exit(1);
  });
}
