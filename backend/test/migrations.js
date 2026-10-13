// Migrations: the runner (scripts/migrate.js) on the original schema, on schema.sql and in the situations
// deploy.sh can meet on the box, plus a check that both ways of building the schema end in the same place.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { section, check } = require('./check');
const { migrate, loadMigrations, MigrationError } = require('../scripts/migrate');

const BACKEND = path.join(__dirname, '..');
const MIGRATE = path.join(BACKEND, 'scripts', 'migrate.js');
const ORIGINAL_SCHEMA = fs.readFileSync(path.join(__dirname, 'fixtures', 'original_schema.sql'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(BACKEND, 'schema.sql'), 'utf8');

// Differences between "original schema + every migration" and "schema.sql" that are known and harmless.
// Each entry must still be a real difference (the test says when one has been fixed, so it can be deleted).
const KNOWN_DRIFT = []; // differences between an upgraded and a fresh database that are accepted on purpose

const quiet = () => {};

/** Runs the CLI against `database` with the given args: { code, out }. */
function cli(cluster, database, args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [MIGRATE, ...args], {
      cwd: os.tmpdir(),
      env: { ...process.env, ...cluster.env(database), DOTENV_CONFIG_QUIET: 'true' },
    }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout + stderr }));
  });
}

/** Columns, constraints and indexes of the public schema, keyed so two databases can be diffed. */
async function snapshot(db) {
  const items = new Map();
  const columns = await db.query(`
    SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public'`);
  for (const c of columns.rows) {
    const key = `column ${c.table_name}.${c.column_name}`;
    items.set(key, `${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}${c.is_nullable === 'NO' ? ' not null' : ''}`);
    items.set(`${key} default`, c.column_default);
  }
  const constraints = await db.query(`
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace`);
  for (const c of constraints.rows) items.set(`constraint ${c.tbl}.${c.conname}`, c.def);
  const indexes = await db.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'");
  for (const i of indexes.rows) items.set(`index ${i.tablename}.${i.indexname}`, i.indexdef);
  return items;
}

function diff(a, b) {
  const out = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(key) !== b.get(key)) out.push({ key, text: `${key}: migrated=${a.get(key) ?? '(missing)'} schema.sql=${b.get(key) ?? '(missing)'}` });
  }
  return out;
}

async function run(cluster) {
  const files = loadMigrations();
  const names = files.map(m => m.name);

  section('runner on the original schema (7d74f77), none applied');
  await cluster.createDatabase('mig_original');
  const orig = await cluster.connect('mig_original');
  await orig.query(ORIGINAL_SCHEMA);
  await orig.query("INSERT INTO players (user_id, turn_order) VALUES ((SELECT id FROM users WHERE username = 'player1'), 1)");
  let r = await cli(cluster, 'mig_original', []);
  const playersLeft = (await orig.query('SELECT count(*)::int AS n FROM players')).rows[0].n;
  check('a database with tables but no history is refused (001 would empty players)',
    r.code === 1 && /--baseline/.test(r.out) && playersLeft === 1, `exit ${r.code}, players ${playersLeft}: ${r.out}`);
  r = await cli(cluster, 'mig_original', ['--assume-none-applied']);
  const recorded = (await orig.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(x => x.name);
  check('--assume-none-applied applies every migration in order and records it',
    r.code === 0 && recorded.join() === names.join(), `exit ${r.code}, recorded ${recorded}: ${r.out}`);
  r = await cli(cluster, 'mig_original', []);
  check('a second run has nothing to do', r.code === 0 && /up to date/.test(r.out), r.out);
  r = await cli(cluster, 'mig_original', ['--status']);
  check('--status lists every migration as applied',
    r.code === 0 && names.every(n => new RegExp(`^applied .*${n}$`, 'm').test(r.out)), r.out);

  section('schema.sql (fresh installs)');
  await cluster.createDatabase('mig_fresh');
  const fresh = await cluster.connect('mig_fresh');
  await fresh.query(SCHEMA);
  const recordedBySchema = (await fresh.query('SELECT name, checksum FROM schema_migrations ORDER BY name')).rows;
  const stale = recordedBySchema.filter(x => files.find(m => m.name === x.name)?.checksum !== x.checksum).map(x => x.name);
  check("schema.sql records only existing migrations, with their files' checksums", stale.length === 0,
    `${stale.join(', ')}: not in migrations/, or the file changed. If it has never been deployed, update its checksum ` +
    'in schema.sql (shasum -a 256 migrations/<file>); if it has, restore the file and make the change a new migration');
  const unrecorded = names.filter(n => !recordedBySchema.some(x => x.name === n));
  const res = await migrate(fresh, { log: quiet }).catch(err => ({ applied: [], error: err.message }));
  check('the runner applies only what schema.sql does not include (never 001)',
    res.applied.join() === unrecorded.join() && !res.applied.includes(names[0]), res.error || `applied ${res.applied}`);

  const drift = diff(await snapshot(orig), await snapshot(fresh));
  const unexpected = drift.filter(d => !KNOWN_DRIFT.includes(d.key));
  check('original schema + migrations and schema.sql have the same columns, constraints and indexes',
    unexpected.length === 0, '\n    ' + unexpected.map(d => d.text).join('\n    '));
  const fixed = KNOWN_DRIFT.filter(k => !drift.some(d => d.key === k));
  check('every KNOWN_DRIFT entry is still a difference', fixed.length === 0, `fixed, delete from KNOWN_DRIFT in test/migrations.js: ${fixed}`);
  await orig.end();
  await fresh.end();

  section('runner safety');
  // The live box: migrations applied by hand with psql before the runner existed.
  await cluster.createDatabase('mig_box');
  const box = await cluster.connect('mig_box');
  await box.query(ORIGINAL_SCHEMA);
  for (const m of files.filter(m => m.number <= 3)) await box.query(m.sql);
  await box.query("INSERT INTO players (user_id, turn_order) VALUES ((SELECT id FROM users WHERE username = 'player1'), 1)");
  r = await cli(cluster, 'mig_box', ['--baseline', '003_game_engine']);
  const boxRecorded = (await box.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(x => x.name);
  const boxPlayers = async () => (await box.query('SELECT count(*)::int AS n FROM players')).rows[0].n;
  check('--baseline 003_game_engine records 001-003 without running them',
    r.code === 0 && boxRecorded.join() === names.slice(0, 3).join() && (await boxPlayers()) === 1, `exit ${r.code} ${boxRecorded}: ${r.out}`);
  r = await cli(cluster, 'mig_box', []);
  const boxAfter = (await box.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(x => x.name);
  check('after the baseline a deploy applies only the later migrations',
    r.code === 0 && boxAfter.join() === names.join() && (await boxPlayers()) === 1, `exit ${r.code} ${boxAfter}: ${r.out}`);

  await box.query("UPDATE schema_migrations SET checksum = 'edited' WHERE name = '002_player_colors'");
  r = await cli(cluster, 'mig_box', []);
  check('an applied migration whose file changed stops the run (exit 1)', r.code === 1 && /002_player_colors\.sql/.test(r.out), `exit ${r.code}: ${r.out}`);
  await box.query("UPDATE schema_migrations SET checksum = $1 WHERE name = '002_player_colors'", [files[1].checksum]);

  // A failing migration: copies of the real files plus a broken one.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polymono-migrations-'));
  for (const m of files) fs.writeFileSync(path.join(dir, m.file), m.sql);
  fs.writeFileSync(path.join(dir, '999_broken.sql'), 'ALTER TABLE users ADD COLUMN half_done INTEGER;\n\nSELECT no_such_column FROM users;\n');
  let error = null;
  try { await migrate(box, { dir, log: quiet }); } catch (err) { error = err; }
  const halfDone = (await box.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'half_done'")).rows[0].n;
  const brokenRecorded = (await box.query("SELECT count(*)::int AS n FROM schema_migrations WHERE name = '999_broken'")).rows[0].n;
  check('a failing migration is rolled back whole and not recorded',
    error instanceof MigrationError && /999_broken\.sql failed \(line 3\): column "no_such_column" does not exist/.test(error.message) && halfDone === 0 && brokenRecorded === 0,
    `${error && error.message} half_done=${halfDone} recorded=${brokenRecorded}`);
  await box.end();

  // The live box's tables belong to the postgres role, not DB_USER: a migration can't alter them.
  await cluster.createDatabase('mig_owner');
  const su = await cluster.connect('mig_owner', 'postgres');
  await su.query(ORIGINAL_SCHEMA);
  await su.end();
  const owner = await cluster.connect('mig_owner');
  fs.rmSync(path.join(dir, '999_broken.sql'));
  fs.writeFileSync(path.join(dir, `${String(files.at(-1).number + 1).padStart(3, '0')}_add_column.sql`), 'ALTER TABLE users ADD COLUMN later INTEGER;\n');
  await migrate(owner, { dir, baseline: files.at(-1).name, log: quiet });
  error = null;
  try { await migrate(owner, { dir, log: quiet }); } catch (err) { error = err; }
  check('tables owned by another role: the error says DB_USER must own them',
    /must be owner of table users[\s\S]*hint: DB_USER must own the tables/.test(error && error.message), error && error.message);
  await owner.end();
  fs.rmSync(dir, { recursive: true, force: true });

  await cluster.createDatabase('mig_race');
  const [a, b] = [await cluster.connect('mig_race'), await cluster.connect('mig_race')];
  await a.query(ORIGINAL_SCHEMA);
  const both = await Promise.allSettled([migrate(a, { assumeNoneApplied: true, log: quiet }), migrate(b, { assumeNoneApplied: true, log: quiet })]);
  const ran = both.flatMap(x => x.value?.applied || []).sort();
  check('two runners at once: the advisory lock makes each migration run exactly once',
    both.every(x => x.status === 'fulfilled') && ran.join() === names.join(), JSON.stringify(both.map(x => x.reason?.message || x.value)));
  await a.end();
  await b.end();

  await cluster.createDatabase('mig_empty');
  r = await cli(cluster, 'mig_empty', []);
  check('an empty database is refused (load schema.sql first)', r.code === 1 && /schema\.sql/.test(r.out), `exit ${r.code}: ${r.out}`);
}

module.exports = { run };
