// Game scenarios against the real server (HTTP and socket.io), with scripted dice and card decks and state set
// up directly in the database. It is one story told in order: each section starts from what the previous
// ones left, so add new sections at the end (or set up the state they need first).
const ioc = require('socket.io-client');
const { section, check } = require('./check');
const { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } = require('../game/mechanics/cards');

let base;            // http://127.0.0.1:<port>
let pool;            // the server's pg pool
let rolls;           // scripted dice: push [die1, die2]; empty = random
let gameController;  // app.gameController (checkDeadline is driven by hand; the timer is stopped)
let alerts;          // ntfy posts captured by the fake ntfy server: [{ topic, body }]
const T = {};        // login tokens by username, plus T.spec (spectator)
const U = {};        // user ids by username

// ---- helpers

const sql = (text, params) => pool.query(text, params).then(r => r.rows);

async function call(token, method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

const act = (token, route, body) => call(token, 'POST', '/api/game/' + route, body);
const state = async () => (await call(T.max, 'GET', '/api/game')).j;
const P = async (username) => (await state()).players.find(p => p.username === username);
const prop = async (pos) => (await state()).properties.find(p => p.position_on_board === pos);
const money = async (username) => (await P(username)).money;
const pid = async (username) => (await P(username)).id;
const id = async (pos) => (await prop(pos)).id;
const log = async (limit) => (await call(T.max, 'GET', `/api/game/log?limit=${limit}`)).j;

/** Opens a socket with `token` and resolves 'connected' or the connect_error message. */
function trySocket(token) {
  return new Promise(resolve => {
    const s = ioc(base, { transports: ['websocket'], reconnection: false, ...(token ? { auth: { token } } : {}) });
    s.on('connect', () => { s.close(); resolve('connected'); });
    s.on('connect_error', e => { s.close(); resolve(e.message); });
  });
}

async function setPlayer(username, fields) {
  const cols = Object.keys(fields);
  await sql(`UPDATE players SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}
             WHERE user_id = (SELECT id FROM users WHERE username = $1)`, [username, ...Object.values(fields)]);
}

/** Makes it `username`'s turn with a fresh turn state (overridden by `ts`) and a deadline a day away. */
async function setTurn(username, ts = {}) {
  const fresh = { phase: 'roll', rolled: false, doubles: 0, lastRoll: null, extraRoll: false, pendingPropertyId: null, debts: [] };
  await sql(`UPDATE game SET current_turn_user_id = (SELECT id FROM users WHERE username = $1), turn_state = $2,
             turn_deadline = now() + interval '1 day'`, [username, JSON.stringify({ ...fresh, ...ts })]);
}

/** Gives the property at board position `pos` to `username` (null = the bank). */
async function own(pos, username, { houses = 0, mortgaged = false } = {}) {
  await sql(`UPDATE properties SET owner_id = (SELECT p.id FROM players p JOIN users u ON u.id = p.user_id WHERE u.username = $4),
             house_count = $2, is_mortgaged = $3 WHERE position_on_board = $1`, [pos, houses, mortgaged, username]);
}

/** Puts card `idx` of `deck` ('chance' | 'community') on top of that deck. */
async function forceCard(deck, idx) {
  const n = (deck === 'chance' ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS).length;
  const order = [idx, ...Array.from({ length: n }, (_, i) => i).filter(i => i !== idx)];
  await sql(`UPDATE game SET decks = jsonb_set(jsonb_set(COALESCE(decks, '{}'::jsonb), '{${deck}}', $1::jsonb), '{held}',
             COALESCE(decks->'held', '{"chance":0,"community":0}'::jsonb))`, [JSON.stringify({ order, pos: 0 })]);
}

/** Expires the running turn's deadline by `interval` and runs the turn timer once. */
async function expireTurn(interval) {
  await sql(`UPDATE game SET turn_deadline = now() - interval '${interval}'`);
  await gameController.checkDeadline();
}

// ---- scenarios

async function setup() {
  await sql('UPDATE properties SET owner_id = NULL, house_count = 0, is_mortgaged = false');
  await sql('DELETE FROM trades');
  await sql('DELETE FROM game_actions');
  await sql('DELETE FROM players');
  await sql(`UPDATE game SET status = 'lobby', current_turn_user_id = NULL, turn_state = '{}', decks = '{}',
             settings = settings || '{"turn_hours":24}'`);
  for (const u of await sql('SELECT id, username FROM users')) U[u.username] = u.id;
  for (const u of ['max', 'jack', 'youngeun']) T[u] = (await call(null, 'POST', '/api/auth/login', { username: u, password: u })).j.token;
  T.spec = (await call(null, 'POST', '/api/auth/spectate')).j.token;
}

async function security() {
  check('register needs admin', (await call(null, 'POST', '/api/auth/register', { username: 'x', password: 'xxxxxx', tokenType: 'taxi' })).s === 401);
  check('users list needs admin', (await call(T.jack, 'GET', '/api/auth/users')).s === 403);
  check('delete user needs admin', (await call(null, 'DELETE', `/api/auth/users/${U.jack}`)).s === 401);
  check('login without password is 400 not 500', (await call(null, 'POST', '/api/auth/login', { username: 'max' })).s === 400);
  check('malformed JSON is 400', (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })).status === 400);
  const noAuth = await trySocket(null);
  check('socket without token rejected', noAuth === 'unauthorized', noAuth);
  await new Promise(res => {
    const s = ioc(base, { transports: ['websocket'], auth: { token: T.jack } });
    s.on('connect', () => { s.emit('user:authenticate'); s.emit('admin:game_reset'); setTimeout(() => { s.close(); res(); }, 300); });
  });
  check('server survives junk socket events', (await call(null, 'GET', '/api/health')).s === 200);
}

async function lobby() {
  for (const u of ['max', 'jack', 'youngeun']) await act(T[u], 'join');
  check('join twice is harmless', (await act(T.max, 'join')).s === 200 && (await state()).players.length === 3);
  check('spectator cannot join', (await act(T.spec, 'join')).s === 403);
  const colors = (await state()).players.map(p => p.player_color);
  check('players get distinct colors', new Set(colors).size === 3 && !colors.includes(null), colors.join());
  check('start needs everyone ready', (await act(T.max, 'start')).s === 400);
  for (const u of ['max', 'jack', 'youngeun']) await act(T[u], 'ready');
  check('only host can start', (await act(T.jack, 'start')).s === 403);
  check('host starts', (await act(T.max, 'start')).s === 200);
  const s = await state();
  check('game in progress, max first, deadline set', s.game.status === 'in_progress' && s.game.current_turn_user_id === U.max && s.game.turn_deadline, JSON.stringify(s.game).slice(0, 200));
  check('decks are not sent to clients', s.game.decks === undefined);
  check('join after start refused', (await act(T.max, 'join')).s === 409);
}

async function phasesAndBuying() {
  check('end turn before rolling refused', (await act(T.max, 'end-turn')).s === 409);
  check('buy before rolling refused', (await act(T.max, 'buy')).s === 409);
  check('not your turn', (await act(T.jack, 'roll')).s === 409);
  check('spectator cannot roll', (await act(T.spec, 'roll')).s === 403);
  rolls.push([1, 2]);
  let r = await act(T.max, 'roll');
  const s = r.j.state;
  check('roll lands on Meatpacking, phase buy', s.game.turn_state.phase === 'buy' && (await P('max')).position === 3, JSON.stringify(s.game.turn_state));
  check('second roll refused', (await act(T.max, 'roll')).s === 409);
  check('end turn while deciding refused', (await act(T.max, 'end-turn')).s === 409);
  check('actions say buy ok', s.game.turn_state.actions.buy.ok && !s.game.turn_state.actions.endTurn.ok);
  r = await act(T.max, 'buy');
  check('bought for $60', r.s === 200 && (await money('max')) === 1440 && (await prop(3)).owner_id === (await P('max')).id);
  check('turn passes on by itself after buying', r.j.state.game.current_turn_user_id === U.jack, String(r.j.state.game.current_turn_user_id));
  check('End turn is not needed any more (409)', (await act(T.max, 'end-turn')).s === 409);
}

async function rent() {
  rolls.push([1, 2]);
  await act(T.jack, 'roll');
  check('jack pays base rent $4', (await money('jack')) === 1496 && (await money('max')) === 1444);
  await act(T.jack, 'end-turn');
}

async function housesAndRent() {
  await own(1, 'max');
  check('build on Meatpacking', (await act(T.max, 'build', { propertyId: await id(3) })).s === 200);
  check('even-build rule enforced', (await act(T.max, 'build', { propertyId: await id(3) })).s === 400);
  check('build on Alphabet City', (await act(T.max, 'build', { propertyId: await id(1) })).s === 200);
  check('build with bad id is 400', (await act(T.max, 'build', { propertyId: 'abc' })).s === 400);
  check('cannot mortgage with houses in group', (await act(T.max, 'mortgage', { propertyId: await id(1) })).s === 400);
  const s = await state();
  check('current_rent for 1 house is rent_values[2]=20', s.properties.find(p => p.position_on_board === 3).current_rent === 20);
  await setPlayer('youngeun', { position: 0 });
  rolls.push([1, 2]);
  const before = await money('youngeun');
  await act(T.youngeun, 'roll');
  check('1-house rent charged $20', before - (await money('youngeun')) === 20, `${before} -> ${await money('youngeun')}`);
  check('sell building refunds half', (await act(T.max, 'sell-building', { propertyId: await id(3) })).s === 200);
  await act(T.youngeun, 'end-turn');
}

async function doubles() {
  await setPlayer('max', { position: 0 });
  await setTurn('max');
  rolls.push([2, 2]);
  let r = await act(T.max, 'roll');
  check('doubles -> roll again', r.j.state.game.turn_state.phase === 'roll' || r.j.state.game.turn_state.phase === 'buy', r.j.state.game.turn_state.phase);
  if (r.j.state.game.turn_state.phase === 'buy') await act(T.max, 'decline');
  rolls.push([3, 3]);
  r = await act(T.max, 'roll');
  if (r.j.state.game.turn_state.phase === 'buy') await act(T.max, 'decline');
  rolls.push([5, 5]);
  r = await act(T.max, 'roll');
  const mx = await P('max');
  check('third doubles -> jail, turn over', mx.is_in_jail && mx.position === 10 && r.j.state.game.current_turn_user_id !== U.max, JSON.stringify(r.j.state.game.turn_state));

  await setPlayer('jack', { position: 26, is_in_jail: false });
  await setTurn('jack');
  rolls.push([2, 2]);
  r = await act(T.jack, 'roll');
  check('doubles onto Go To Jail: jailed, no extra roll', (await P('jack')).is_in_jail && r.j.state.game.current_turn_user_id !== U.jack, r.j.state.game.turn_state.phase);
}

async function jail() {
  await setPlayer('max', { is_in_jail: true, position: 10, jail_turns: 0, money: 1000 });
  await setTurn('max');
  rolls.push([1, 2]);
  let r = await act(T.max, 'roll');
  check('failed jail roll: stays, turn over', (await P('max')).is_in_jail && (await P('max')).jail_turns === 1 && r.j.state.game.current_turn_user_id !== U.max);
  await setTurn('max');
  check('pay fine before rolling', (await act(T.max, 'pay-fine')).s === 200 && !(await P('max')).is_in_jail && (await money('max')) === 950);
  check('cannot pay fine twice', (await act(T.max, 'pay-fine')).s === 400);

  await setPlayer('max', { is_in_jail: true, position: 10, jail_turns: 2, money: 1000 });
  await setTurn('max');
  rolls.push([3, 5]);
  r = await act(T.max, 'roll');
  const m3 = await P('max');
  check('3rd failed jail roll: pays $50 and moves 8', !m3.is_in_jail && m3.position === 18 && m3.money <= 950, JSON.stringify({ pos: m3.position, money: m3.money, jail: m3.is_in_jail }));
  if (r.j.state.game.turn_state.phase === 'buy') await act(T.max, 'decline');

  await own(16, 'jack');
  await setPlayer('max', { is_in_jail: true, position: 10, jail_turns: 0, money: 1000 });
  await setTurn('max');
  rolls.push([3, 3]);
  r = await act(T.max, 'roll');
  check('doubles escape lands on owned property and pays rent', !(await P('max')).is_in_jail && (await P('max')).position === 16 && (await money('max')) === 1000 - 14, `money ${await money('max')}`);
  check('doubles escape gives no extra roll', r.j.state.game.current_turn_user_id !== U.max);

  await setPlayer('max', { is_in_jail: true, position: 10, jail_turns: 0, get_out_of_jail_cards: 1 });
  await setTurn('max');
  check('use jail card', (await act(T.max, 'use-card')).s === 200 && (await P('max')).get_out_of_jail_cards === 0 && !(await P('max')).is_in_jail);
}

async function cards() {
  await setPlayer('max', { position: 4, money: 1000, is_in_jail: false });
  await setTurn('max');
  await forceCard('chance', 6); // go back 3
  rolls.push([1, 2]); // 4 -> 7 Opportunity -> back to 4 City Income Tax
  await act(T.max, 'roll');
  check('back 3 onto Income Tax charges $200', (await P('max')).position === 4 && (await money('max')) === 800, `pos ${(await P('max')).position} money ${await money('max')}`);

  await own(15, 'jack');
  await own(5, 'jack');
  await setPlayer('max', { position: 4, money: 1000 });
  await setTurn('max');
  await forceCard('chance', 3); // nearest railroad
  rolls.push([1, 2]);
  await act(T.max, 'roll');
  check('nearest Subway Station owned (2 owned): pays 2x $50', (await P('max')).position === 15 && (await money('max')) === 900, `pos ${(await P('max')).position} money ${await money('max')}`);

  await setPlayer('max', { position: 34, money: 1000 });
  await own(39, 'jack');
  await setTurn('max');
  await forceCard('chance', 16); // advance to One WTC
  rolls.push([1, 1]); // 34 -> 36 Opportunity (doubles)
  const r = await act(T.max, 'roll');
  check('advance to One WTC owned: rent $50 paid', (await P('max')).position === 39 && (await money('max')) === 950, `money ${await money('max')}`);
  check('after doubles + card move, may roll again', r.j.state.game.turn_state.phase === 'roll', r.j.state.game.turn_state.phase);
  const ev = await log(20);
  check('event log has card and rent text', ev.some(e => e.type === 'card' && e.text) && ev.some(e => e.type === 'rent' && /One World Trade Center/.test(e.text)));

  // A Get Out of Jail Free card held by a player is not drawn again.
  await sql(`UPDATE game SET decks = jsonb_set(decks, '{held}', '{"chance":1,"community":0}')`);
  await setPlayer('max', { position: 4, money: 1000 });
  await setTurn('max');
  await forceCard('chance', 8); // jail free (held) -> should skip to next card
  rolls.push([1, 2]);
  await act(T.max, 'roll');
  check('held jail-free card is skipped', (await P('max')).get_out_of_jail_cards === 0);
}

async function debtAndBankruptcy() {
  await own(39, 'jack', { houses: 5 });
  await own(37, 'jack', { houses: 5 });
  await setPlayer('max', { position: 34, money: 100 });
  await own(6, 'max');
  await own(8, 'max');
  await setTurn('max');
  rolls.push([2, 3]); // 34 -> 39 hotel rent 2000
  let r = await act(T.max, 'roll');
  check('cannot afford rent -> debt phase', r.j.state.game.turn_state.phase === 'debt' && r.j.state.game.turn_state.debts[0].amount === 2000, JSON.stringify(r.j.state.game.turn_state));
  check('end turn blocked while in debt', (await act(T.max, 'end-turn')).s === 409);
  check('pay debts blocked without cash', (await act(T.max, 'pay-debts')).s === 400);
  check('mortgage to raise money works in debt', (await act(T.max, 'mortgage', { propertyId: await id(6) })).s === 200 && (await money('max')) === 150);
  const jackBefore = await money('jack');
  r = await act(T.max, 'bankrupt');
  let s = r.j.state;
  const jackP = s.players.find(p => p.username === 'jack');
  const p6 = s.properties.find(p => p.position_on_board === 6);
  check('bankruptcy: max out, jack gets cash, house refund + properties',
    s.players.find(p => p.username === 'max').is_bankrupt && jackP.money === jackBefore + 150 + 25 && p6.owner_id === jackP.id && p6.is_mortgaged,
    JSON.stringify({ jm: jackP.money, jackBefore }));
  check('turn moved on from bankrupt player', s.game.current_turn_user_id !== U.max);

  await setPlayer('youngeun', { position: 34, money: 10 });
  await setTurn('youngeun');
  rolls.push([2, 3]);
  await act(T.youngeun, 'roll');
  r = await act(T.youngeun, 'bankrupt');
  s = r.j.state;
  const hist = (await call(T.jack, 'GET', '/api/game/history')).j;
  check('finished game is saved with standings', Array.isArray(hist) && hist.length >= 1 && hist[0].winner_user_id === U.jack && hist[0].standings[0].username === 'jack', JSON.stringify(hist && hist[0]));
  check('last player standing wins', s.game.status === 'completed' && s.game.winner_user_id === U.jack, JSON.stringify({ st: s.game.status, w: s.game.winner_user_id }));
  check('roll after game over refused', (await act(T.jack, 'roll')).s === 409);
  r = await act(T.jack, 'new');
  check('new game returns everyone to the lobby', r.s === 200 && r.j.state.game.status === 'lobby' && r.j.state.players.length === 3 && r.j.state.players.every(p => !p.is_bankrupt && p.money === 1500 && !p.ready_to_start));
  check('/new while in the lobby is refused', (await act(T.jack, 'new')).s === 409);
}

async function trades() {
  for (const u of ['max', 'jack', 'youngeun']) await act(T[u], 'ready');
  await act(T.max, 'start');
  await own(1, 'max');
  await own(3, 'max');
  await own(6, 'jack');
  await own(8, 'jack');
  const offer = async (from, body) => call(T[from], 'POST', '/api/trade', body);
  check('negative money offer refused', (await offer('max', { recipientPlayerId: await pid('jack'), offeredMoney: -500, requestedProperties: [await id(6)] })).s === 400);
  check('null money is treated as 0, not NULL', (await offer('max', { recipientPlayerId: await pid('jack'), offeredMoney: null, offeredProperties: [await id(1)] })).s === 200);
  check('cannot offer property you do not own', (await offer('max', { recipientPlayerId: await pid('jack'), offeredProperties: [await id(6)] })).s === 400);
  check('duplicate property ids refused', (await offer('max', { recipientPlayerId: await pid('jack'), offeredProperties: [await id(1), await id(1)] })).s === 400);
  check('recipient id as string refused', (await offer('max', { recipientPlayerId: String(await pid('jack')), offeredMoney: 10 })).s === 400);

  const tr = (await offer('max', { recipientPlayerId: await pid('jack'), offeredProperties: [await id(3)], offeredMoney: 50, requestedProperties: [await id(6)] })).j.trade;
  const ctr = await call(T.jack, 'POST', `/api/trade/${tr.id}/counter`, { offeredProperties: [await id(6)], requestedProperties: [await id(3)], requestedMoney: 200 });
  check('counter creates a new offer back to max', ctr.s === 200 && ctr.j.trade.proposer_id === (await pid('jack')) && ctr.j.trade.countered_from === tr.id);
  check('original is closed after counter', (await call(T.max, 'POST', `/api/trade/${tr.id}/accept`)).s === 409);
  check('counterer cannot accept their own counter', (await call(T.jack, 'POST', `/api/trade/${ctr.j.trade.id}/accept`)).s === 403);
  const mBefore = await money('max');
  const jBefore = await money('jack');
  const [a1, a2] = await Promise.all([call(T.max, 'POST', `/api/trade/${ctr.j.trade.id}/accept`), call(T.max, 'POST', `/api/trade/${ctr.j.trade.id}/accept`)]);
  check('double accept: exactly one succeeds', [a1.s, a2.s].sort().join() === '200,409', `${a1.s},${a2.s}`);
  check('money moved once', (await money('max')) === mBefore - 200 && (await money('jack')) === jBefore + 200, `${mBefore}->${await money('max')}`);
  check('properties swapped', (await prop(6)).owner_id === (await pid('max')) && (await prop(3)).owner_id === (await pid('jack')));
  const list = (await call(T.max, 'GET', '/api/trade')).j;
  check('first offer (Alphabet City) still pending, has history', list.active.length === 1 && list.history.length >= 2, JSON.stringify(list.active.map(t => t.status)));

  await own(1, 'max');
  await own(3, 'max', { houses: 1 });
  check('cannot trade a street while its group has houses', (await offer('max', { recipientPlayerId: await pid('jack'), offeredProperties: [await id(1)] })).s === 400);
  await own(3, 'max');
}

async function concurrency() {
  await setPlayer('max', { position: 0, money: 1500 });
  await setTurn('max');
  rolls.push([1, 3], [1, 3], [1, 3], [1, 3], [1, 3]);
  const many = await Promise.all(Array.from({ length: 5 }, () => act(T.max, 'roll')));
  check('5 parallel rolls: exactly one succeeds', many.filter(x => x.s === 200).length === 1, many.map(x => x.s).join());
  rolls.length = 0;

  await own(1, 'max');
  await own(3, 'max');
  await setPlayer('max', { money: 120 });
  const builds = await Promise.all([act(T.max, 'build', { propertyId: await id(1) }), act(T.max, 'build', { propertyId: await id(3) }), act(T.max, 'build', { propertyId: await id(1) })]);
  check('parallel builds respect cash ($120 buys 2 houses)', (await money('max')) === 20 && builds.filter(b => b.s === 200).length === 2, `${await money('max')} ${builds.map(b => b.s)}`);
}

async function turnTimer() {
  await setTurn('jack', { phase: 'buy', rolled: true, pendingPropertyId: await id(39) });
  await own(39, null);
  await expireTurn('1 minute');
  const s = await state();
  check('timeout declines and skips to the next player', s.game.current_turn_user_id === U.youngeun && (await prop(39)).owner_id === null, String(s.game.current_turn_user_id));
  await setTurn('jack', { phase: 'debt', rolled: true, debts: [{ creditorId: null, amount: 50, reason: 'x' }] });
  await expireTurn('1 minute');
  check('timeout leaves a debt for the player', (await state()).game.current_turn_user_id === U.jack);
}

async function timeoutsPlayTheTurn() {
  await sql('UPDATE properties SET owner_id = NULL, house_count = 0, is_mortgaged = false');
  await setPlayer('jack', { position: 0, money: 1500, is_in_jail: false, jail_turns: 0 });
  await setTurn('jack');
  rolls.push([1, 2]);
  await expireTurn('1 minute');
  const s = await state();
  check('timeout auto-plays: jack rolls, passes on Meatpacking, the turn moves on',
    (await P('jack')).position === 3 && (await prop(3)).owner_id === null && s.game.current_turn_user_id === U.youngeun,
    `${(await P('jack')).position} ${s.game.current_turn_user_id}`);
  await setPlayer('jack', { position: 10, is_in_jail: true, jail_turns: 0 });
  await setTurn('jack');
  rolls.push([1, 2]);
  await expireTurn('1 minute');
  check('timeout in Rikers counts as a jail attempt', (await P('jack')).jail_turns === 1 && (await P('jack')).is_in_jail);
  await setPlayer('jack', { is_in_jail: false, jail_turns: 0 });
}

async function phoneAlerts() {
  const on = await call(T.jack, 'POST', '/api/auth/alerts', { enabled: true });
  check('turning alerts on returns a private topic', on.s === 200 && on.j.enabled && /^polymono-/.test(on.j.topic));
  check('alert settings are readable', (await call(T.jack, 'GET', '/api/auth/alerts')).j.topic === on.j.topic);
  alerts.length = 0;
  await setPlayer('max', { position: 0, is_in_jail: false });
  await setTurn('max');
  rolls.push([1, 2]);
  await act(T.max, 'roll');
  if ((await state()).game.turn_state.phase === 'buy') await act(T.max, 'decline');
  await new Promise(r => setTimeout(r, 300));
  check('jack (offline) gets a your-turn alert', (await state()).game.current_turn_user_id === U.jack &&
    alerts.some(a => a.topic === on.j.topic && /your turn/i.test(a.body)), JSON.stringify(alerts));
  check('test alert endpoint works', (await call(T.jack, 'POST', '/api/auth/alerts/test')).s === 200);
  const off = await call(T.jack, 'POST', '/api/auth/alerts', { enabled: false });
  check('turning alerts off forgets the topic', off.j.enabled === false && off.j.topic === null);
  check('spectators have no alerts', (await call(T.spec, 'GET', '/api/auth/alerts')).s === 403);
}

async function cardText() {
  await setPlayer('max', { position: 4, money: 1000, is_in_jail: false });
  await setTurn('max');
  await forceCard('chance', 9); // dividend $50
  rolls.push([1, 2]);
  await act(T.max, 'roll');
  const cardEv = (await log(10)).filter(e => e.type === 'card').pop();
  check('card event keeps card text in data.cardText', cardEv && cardEv.data.cardText === 'Bank pays you a dividend of $50', JSON.stringify(cardEv && cardEv.data));
}

async function debtorsAndTrades() {
  await own(39, 'jack', { houses: 5 });
  await own(1, 'max');
  await own(3, 'max');
  await setPlayer('max', { position: 34, money: 500 });
  await setTurn('max');
  rolls.push([2, 3]);
  await act(T.max, 'roll');
  check('in debt after hotel rent', (await state()).game.turn_state.phase === 'debt');
  const offer = async (body) => call(T.max, 'POST', '/api/trade', { recipientPlayerId: await pid('youngeun'), ...body });
  check('debtor cannot trade cash away', (await offer({ offeredMoney: 400 })).s === 400);
  check('debtor cannot sell below mortgage value', (await offer({ offeredProperties: [await id(1)], requestedMoney: 1 })).s === 400);
  check('debtor may sell for real money', (await offer({ offeredProperties: [await id(1)], requestedMoney: 100 })).s === 200);

  await setPlayer('max', { money: 5000 });
  const paid = await act(T.max, 'pay-debts');
  const dp = (await log(5)).filter(e => e.type === 'debts_paid').pop();
  check('debts_paid lists creditor payments', paid.s === 200 && dp && dp.data.payments?.[0]?.creditorUserId === U.jack && /jack/.test(dp.text), JSON.stringify(dp));
}

async function debtDeadlines() {
  // Paying late (after the deadline, before the timer ran) gets a fresh deadline instead of a skipped turn.
  await setPlayer('max', { position: 34, money: 100 });
  await setTurn('max');
  rolls.push([2, 3]);
  await act(T.max, 'roll');
  await sql("UPDATE game SET turn_deadline = now() - interval '2 hours'");
  await setPlayer('max', { money: 5000 });
  await act(T.max, 'pay-debts');
  await gameController.checkDeadline();
  check('paying a debt late ends the turn normally with a fresh deadline', (await state()).game.current_turn_user_id === U.jack && new Date((await state()).game.turn_deadline) > new Date());

  // A debt left unpaid for a whole extra turn period ends in bankruptcy.
  await setPlayer('max', { position: 34, money: 100 });
  await setTurn('max');
  rolls.push([2, 3]);
  await act(T.max, 'roll');
  await expireTurn('50 hours');
  const s = await state();
  check('abandoned debt ends in bankruptcy after the grace period', s.players.find(p => p.username === 'max').is_bankrupt && s.game.current_turn_user_id !== U.max, String(s.game.current_turn_user_id));
  await sql('UPDATE players SET is_bankrupt = false, money = 1500 WHERE user_id = $1', [U.max]);
}

async function houseShortage() {
  await sql('UPDATE properties SET owner_id = NULL, house_count = 0, is_mortgaged = false');
  await own(37, 'jack', { houses: 5 });
  await own(39, 'jack', { houses: 5 });
  await sql('UPDATE properties SET house_count = 4 WHERE position_on_board IN (1,3,6,8,9,11,13)'); // 28 houses in play
  await sql('UPDATE properties SET house_count = 2 WHERE position_on_board = 14'); // 30 in play -> 2 left
  const jackMoney = await money('jack');
  const brk = await act(T.jack, 'sell-building', { propertyId: await id(39) });
  check('hotel breaks to the 2 houses the bank has, refunding 3 buildings', brk.s === 200 && (await prop(39)).house_count === 2 && (await money('jack')) === jackMoney + 300, `${brk.s} ${(await prop(39)).house_count} ${(await money('jack')) - jackMoney}`);
  await sql('UPDATE properties SET owner_id = NULL, house_count = 0, is_mortgaged = false');
}

async function settingsAndIds() {
  await call(T.max, 'PATCH', '/api/admin/settings', { turn_hours: 0 });
  check('turn_hours 0 clears the running deadline', (await state()).game.turn_deadline === null);
  await call(T.max, 'PATCH', '/api/admin/settings', { turn_hours: 24 });
  check('turn_hours 24 sets a deadline again', !!(await state()).game.turn_deadline);
  check('huge trade id is 400', (await call(T.max, 'POST', '/api/trade/99999999999/accept')).s === 400);
  check('huge admin user id is 400', (await call(T.max, 'POST', '/api/admin/users/99999999999/password', { newPassword: 'abcdefg' })).s === 400);
  check('trade id with junk is 400', (await call(T.max, 'POST', '/api/trade/12abc/accept')).s === 400);
}

async function chat() {
  check('spectator chat is 403 (no SQL leak)', (await call(T.spec, 'POST', '/api/chat/send', { message: 'hi' })).s === 403);
  check('chat length limited', (await call(T.max, 'POST', '/api/chat/send', { message: 'x'.repeat(600) })).s === 400);
  check('chat works', (await call(T.max, 'POST', '/api/chat/send', { message: 'gg' })).s === 200);
}

async function admin() {
  const users = await call(T.max, 'GET', '/api/auth/users');
  check('admin lists users', users.s === 200 && users.j.length >= 6);
  check('admin cannot delete user in game', (await call(T.max, 'DELETE', `/api/auth/users/${U.jack}`)).s === 409);
  check('settings validated', (await call(T.max, 'PATCH', '/api/admin/settings', { turn_hours: -1 })).s === 400 && (await call(T.max, 'PATCH', '/api/admin/settings', { turn_hours: 48 })).s === 200);
  check('version increments', (await state()).game.version > 10);
}

// Last: changes youngeun's password and restores it.
async function tokenRevocation() {
  const oldTok = T.youngeun;
  const ch = await call(oldTok, 'POST', '/api/auth/password', { currentPassword: 'youngeun', newPassword: 'newpass123' });
  check('password change returns a fresh token', ch.s === 200 && !!ch.j.token);
  check('old token is revoked after password change', (await call(oldTok, 'GET', '/api/game')).s === 401);
  check('fresh token works', (await call(ch.j.token, 'GET', '/api/game')).s === 200);
  const revoked = await trySocket(oldTok);
  check('revoked token cannot open a socket', revoked === 'unauthorized', revoked);
  check('admin reset revokes the fresh token too', (await call(T.max, 'POST', `/api/admin/users/${U.youngeun}/password`, { newPassword: 'youngeun' })).s === 200 && (await call(ch.j.token, 'GET', '/api/game')).s === 401);
  check('login with restored password works', (await call(null, 'POST', '/api/auth/login', { username: 'youngeun', password: 'youngeun' })).s === 200);
}

const SCENARIOS = [
  ['security', security],
  ['lobby', lobby],
  ['phase gating and buying', phasesAndBuying],
  ['rent', rent],
  ['houses and rent tiers', housesAndRent],
  ['doubles', doubles],
  ['jail', jail],
  ['cards', cards],
  ['debt, bankruptcy, game over, new game', debtAndBankruptcy],
  ['trades (second game)', trades],
  ['concurrency', concurrency],
  ['turn timer', turnTimer],
  ['card text in the log', cardText],
  ['debtors: trades and paying', debtorsAndTrades],
  ['debt deadlines', debtDeadlines],
  ['house shortage', houseShortage],
  ['settings and malformed ids', settingsAndIds],
  ['timeouts play the turn', timeoutsPlayTheTurn],
  ['phone alerts', phoneAlerts],
  ['chat', chat],
  ['admin', admin],
  ['token revocation', tokenRevocation],
];

async function run(ctx) {
  ({ base, pool, rolls, gameController, alerts } = ctx);
  await setup();
  for (const [title, fn] of SCENARIOS) {
    section(title);
    await fn();
  }
}

module.exports = { run };
