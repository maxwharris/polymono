/**
 * Main Game Controller - the authoritative game engine.
 *
 * Every mutating action runs one at a time (an in-process queue; the backend is a single pm2 fork) inside
 * a Postgres transaction that locks the game row. Turn state (phase, doubles, pending purchase, debts) and
 * the card decks live in the game row, so nothing is lost on restart. After each commit the controller
 * broadcasts a full `game:state` snapshot and the `game:events` the action produced (see API.md).
 */

const pool = require('../db');
const q = require('../db/queries');
const tq = require('../db/tradeQueries');
const board = require('./board');
const boardData = require('../data/properties');
const { GameError } = require('./errors');
const { rollDice } = require('./mechanics/dice');
const { freshDecks, returnJailCard } = require('./mechanics/cards');
const rules = require('./mechanics/property');
const turns = require('./mechanics/turnManager');
const { moveBy, sendToJail } = require('./mechanics/movement');
const jail = require('./mechanics/jail');
const { resolveLanding } = require('./mechanics/landing');
const trades = require('./mechanics/trade');
const { sendAlert } = require('./notifier');

const SPACE_NAMES = Object.fromEntries(boardData.map(s => [s.position, s.name]));

// game_actions row -> event sent to clients. The actor's name is stored in the row so the log survives
// players being removed.
function formatEvent(row) {
  const { text = null, username = null, userId = null, ...data } = row.action_data || {};
  return {
    id: row.id,
    type: row.action_type,
    player_id: row.player_id,
    user_id: row.user_id ?? userId,
    username: row.username ?? username,
    data,
    text,
    timestamp: row.timestamp
  };
}

/** Transaction context handed to the mechanics modules. */
class GameTx {
  constructor(db) {
    this.db = db;
    this.events = [];
    this.notices = [];
    this.alerts = [];
  }

  async load() {
    this.game = await q.lockGame(this.db);
    this.ts = turns.normalizeTurnState(this.game.turn_state);
    this.decks = this.game.decks || {};
  }

  spaceName(position) {
    return SPACE_NAMES[position] || `space ${position}`;
  }

  // `player` may be a deleted player ({ username, user_id } without id). `text` null = animation-only event.
  async log(type, player, data, text) {
    const row = await q.insertAction(this.db, player?.id ?? null, type, {
      ...data,
      text,
      username: player?.username ?? null,
      userId: player?.user_id ?? null
    });
    this.events.push(formatEvent(row));
  }

  // Phone alert (ntfy) for these users, sent after commit if they are not online.
  alert(userIds, message) {
    this.alerts.push({ userIds: userIds.filter(Boolean), message });
  }

  notify(name, trade) {
    this.notices.push({
      name,
      users: [trade.proposer_user_id, trade.recipient_user_id],
      payload: { tradeId: trade.id, status: trade.status, proposerUserId: trade.proposer_user_id, recipientUserId: trade.recipient_user_id }
    });
  }

  async charge(player, amount, creditorId, reason, event) {
    return this.chargeMany(player, [{ creditorId, amount }], reason, event);
  }

  /**
   * The current player pays several parties at once. If they can't cover it all (or already owe money),
   * nothing moves and the amounts are recorded as debts: the turn then waits in the 'debt' phase.
   */
  async chargeMany(player, items, reason, event) {
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const payer = await q.getPlayerById(this.db, player.id);
    if (total <= 0) {
      if (event) await this.log(event.type, payer, event.data, event.text);
      return true;
    }
    if (!this.ts.debts.length && payer.money >= total) {
      await q.addMoney(this.db, payer.id, -total);
      for (const i of items) {
        if (i.creditorId) await q.addMoney(this.db, i.creditorId, i.amount);
      }
      if (event) await this.log(event.type, payer, event.data, event.text);
      return true;
    }
    for (const i of items) {
      this.ts.debts.push({ creditorId: i.creditorId ?? null, amount: i.amount, reason });
    }
    const owed = this.ts.debts.reduce((sum, d) => sum + d.amount, 0);
    await this.log('debt', payer, { amount: total, creditorIds: items.map(i => i.creditorId ?? null), reason, totalOwed: owed },
      `${payer.username} owes $${total} for ${reason} but has $${payer.money}: they must raise money or go bankrupt`);
    return false;
  }
}

function phaseReason(phase) {
  return {
    roll: 'Roll the dice first',
    buy: 'Buy or decline the property first',
    debt: 'Pay what you owe first',
    end: 'You already rolled this turn',
    over: 'The game is over'
  }[phase] || 'Not now';
}

// What the current player can do right now, with a reason for everything they can't.
function turnActions(ts, me, properties) {
  const allow = (ok, reason) => (ok ? { ok: true } : { ok: false, reason });
  const pending = properties.find(p => p.id === ts.pendingPropertyId);
  const owed = ts.debts.reduce((sum, d) => sum + d.amount, 0);
  const beforeRoll = ts.phase === 'roll' && !ts.rolled;
  const jailReason = !me.is_in_jail ? 'You are not in Rikers' : 'Only before you roll';
  return {
    roll: allow(ts.phase === 'roll', phaseReason(ts.phase)),
    buy: ts.phase !== 'buy' || !pending
      ? allow(false, 'Nothing to buy')
      : allow(me.money >= pending.purchase_price, `You need $${pending.purchase_price - me.money} more: mortgage or sell something, or decline`),
    decline: allow(ts.phase === 'buy', 'Nothing to decline'),
    payFine: me.is_in_jail && beforeRoll ? allow(me.money >= board.JAIL_FINE, `You need $${board.JAIL_FINE}`) : allow(false, jailReason),
    useCard: me.is_in_jail && beforeRoll ? allow(me.get_out_of_jail_cards > 0, 'You have no Get Out of Jail Free card') : allow(false, jailReason),
    payDebts: ts.phase === 'debt' ? allow(me.money >= owed, `Raise $${owed - me.money} more`) : allow(false, 'You owe nothing'),
    bankrupt: allow(ts.phase === 'debt', 'Only when you owe more than you can pay'),
    endTurn: allow(ts.phase === 'end', phaseReason(ts.phase))
  };
}

// For an owned property: what its owner can do with it (null = allowed, otherwise the reason not).
function management(owner, property, all) {
  const why = (check) => {
    try {
      check();
      return null;
    } catch (err) {
      return err.message;
    }
  };
  return {
    build: why(() => rules.checkBuild(owner, property, all)),
    sell: why(() => rules.checkSellBuilding(owner, property, all)),
    mortgage: why(() => rules.checkMortgage(owner, property, all)),
    unmortgage: why(() => rules.checkUnmortgage(owner, property)),
    unmortgageCost: rules.unmortgageCost(property)
  };
}

function buildState(game, players, properties) {
  const { decks, ...publicGame } = game; // the deck order is secret
  const ts = turns.normalizeTurnState(game.turn_state);
  const current = players.find(p => p.user_id === game.current_turn_user_id);
  return {
    game: {
      ...publicGame,
      settings: { ...board.DEFAULT_SETTINGS, ...(game.settings || {}) },
      turn_state: {
        ...ts,
        actions: game.status === 'in_progress' && current ? turnActions(ts, current, properties) : {}
      }
    },
    players,
    properties: properties.map(p => {
      const owner = p.owner_id ? players.find(pl => pl.id === p.owner_id) : null;
      return {
        ...p,
        current_rent: rules.calculateRent(p, properties),
        management: owner ? management(owner, p, properties) : null
      };
    }),
    supply: rules.buildingSupply(properties),
    serverTime: new Date().toISOString()
  };
}

function requireInt(value, name) {
  if (!Number.isInteger(value) || value <= 0 || value > 2147483647) throw new GameError(`${name} must be an id`);
  return value;
}

async function requireTurn(t, userId) {
  if (t.game.status !== 'in_progress') throw new GameError('The game is not in progress', 409);
  if (t.game.current_turn_user_id !== userId) throw new GameError("It's not your turn", 409);
  const me = await q.getPlayerByUserId(t.db, userId);
  if (!me || me.is_bankrupt) throw new GameError('You are not playing in this game', 403);
  return me;
}

async function requireActive(t, userId) {
  if (t.game.status !== 'in_progress') throw new GameError('The game is not in progress', 409);
  const me = await q.getPlayerByUserId(t.db, userId);
  if (!me || me.is_bankrupt) throw new GameError('You are not playing in this game', 403);
  return me;
}

async function requireLobby(t) {
  if (t.game.status === 'in_progress') throw new GameError('The game has already started', 409);
  if (t.game.status === 'completed') throw new GameError('This game is over. Start a new one from the results screen.', 409);
}

async function renumberSeats(db) {
  await db.query(`
    UPDATE players SET turn_order = s.rn
    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY turn_order) AS rn FROM players) s
    WHERE players.id = s.id`);
}

/** The dice and everything they cause, for the current player. Shared by the Roll button and the turn timer. */
async function playRoll(t, me) {
  const roll = rollDice();
  t.ts.lastRoll = roll;
  t.ts.rolled = true;
  t.ts.extraRoll = false;
  await t.log('roll', me, roll, `${me.username} rolled ${roll.die1} + ${roll.die2} = ${roll.total}${roll.isDoubles ? ' (doubles)' : ''}`);

  if (me.is_in_jail) {
    const freed = await jail.rollFromJail(t, me, roll);
    if (freed) {
      const moved = await moveBy(t, freed, roll.total, 'roll');
      await resolveLanding(t, moved, { diceTotal: roll.total });
    }
  } else if (roll.isDoubles && t.ts.doubles >= 2) {
    await sendToJail(t, me, 'three_doubles');
  } else {
    if (roll.isDoubles) t.ts.doubles += 1;
    const moved = await moveBy(t, me, roll.total, 'roll');
    await resolveLanding(t, moved, { diceTotal: roll.total });
    const after = await q.getPlayerById(t.db, me.id);
    t.ts.extraRoll = roll.isDoubles && !after.is_in_jail;
  }
  turns.settle(t.ts);
  return roll;
}

// Nothing left to decide: the turn passes on by itself (building and trading are allowed any time anyway).
async function finishTurnIfDone(t) {
  if (t.ts.phase === 'end' && t.game.status === 'in_progress') await turns.advanceTurn(t);
}

async function declinePending(t, me, { timeout = false } = {}) {
  const property = await q.getPropertyById(t.db, t.ts.pendingPropertyId);
  const text = timeout ? `${me.username} was away and passed on ${property.name}` : `${me.username} passed on ${property.name}`;
  await t.log('decline', me, { propertyId: property.id, ...(timeout ? { timeout: true } : {}) }, text);
  t.ts.pendingPropertyId = null;
  turns.settle(t.ts);
}

/**
 * Buildings go back to the bank for half their cost. If everything is owed to one player, they get the
 * cash, properties (still mortgaged) and jail cards; otherwise player creditors are paid from the cash in
 * order and the properties return to the bank unmortgaged. Then the turn moves on, or the game ends.
 */
async function declareBankruptcy(t, me, reasonText = null) {
  const debts = t.ts.debts;
  const playerCreditors = [...new Set(debts.map(d => d.creditorId).filter(Boolean))];
  const heirId = playerCreditors.length === 1 && debts.every(d => d.creditorId === playerCreditors[0]) ? playerCreditors[0] : null;
  const heirRow = heirId ? await q.getPlayerById(t.db, heirId) : null;
  const heir = heirRow && !heirRow.is_bankrupt ? heirRow : null;

  const owned = (await q.getAllProperties(t.db)).filter(p => p.owner_id === me.id);
  let cash = me.money;
  for (const p of owned) {
    cash += p.house_count * Math.floor((p.house_cost || 0) / 2);
  }
  cash = Math.max(0, cash);

  if (heir) {
    await q.addMoney(t.db, heir.id, cash);
    for (const p of owned) await q.updateProperty(t.db, p.id, { owner_id: heir.id, house_count: 0 });
    if (me.get_out_of_jail_cards) {
      await t.db.query('UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + $2 WHERE id = $1', [heir.id, me.get_out_of_jail_cards]);
    }
  } else {
    for (const debt of debts.filter(d => d.creditorId)) {
      const creditor = await q.getPlayerById(t.db, debt.creditorId);
      const pay = Math.min(cash, debt.amount);
      if (pay > 0 && creditor && !creditor.is_bankrupt) {
        await q.addMoney(t.db, creditor.id, pay);
        cash -= pay;
      }
    }
    for (const p of owned) await q.updateProperty(t.db, p.id, { owner_id: null, is_mortgaged: false, house_count: 0 });
    returnJailCard(t.decks, me.get_out_of_jail_cards);
  }

  const out = await q.updatePlayer(t.db, me.id, {
    money: 0, is_bankrupt: true, is_in_jail: false, jail_turns: 0, get_out_of_jail_cards: 0
  });
  for (const tradeId of await tq.cancelTradesForPlayer(t.db, me.id)) {
    t.notify('trade:changed', await tq.getTradeById(t.db, tradeId));
  }
  const outcome = heir ? `${heir.username} takes everything they had` : 'their properties return to the bank';
  await t.log('bankrupt', out, { creditorId: heir?.id ?? null },
    `${reasonText ? `${reasonText}. ` : ''}${me.username} went bankrupt; ${outcome}`);
  t.ts.debts = [];
  t.ts.pendingPropertyId = null;
  await trades.expireImpossibleTrades(t);

  const active = (await q.getAllPlayers(t.db)).filter(p => !p.is_bankrupt);
  if (active.length <= 1) {
    await turns.endGame(t, active[0] || null);
  } else {
    await turns.advanceTurn(t);
  }
}

// Turn into phone alerts: whose turn it is, trade offers, debts, the end of the game.
function alertsFor(t) {
  const out = [...t.alerts];
  for (const e of t.events) {
    if (e.type === 'turn') out.push({ userIds: [e.user_id], message: "It's your turn in Polymono." });
    else if (e.type === 'trade_offer' || e.type === 'trade_countered') out.push({ userIds: [e.data.recipientUserId], message: `${e.username} sent you a trade offer.` });
    else if (e.type === 'trade_accepted') out.push({ userIds: [e.data.proposerUserId], message: `${e.username} accepted your trade.` });
    else if (e.type === 'debt') out.push({ userIds: [e.user_id], message: `You owe $${e.data.totalOwed}. Raise the money or declare bankruptcy.` });
    else if (e.type === 'game_over') out.push({ userIds: 'all', message: e.text });
  }
  return out;
}

async function sendAlerts(t, isOnline = () => false) {
  const wanted = alertsFor(t);
  if (!wanted.length) return;
  const rows = (await pool.query('SELECT id, notify_topic FROM users WHERE notify_topic IS NOT NULL')).rows;
  const topics = new Map(rows.map(r => [r.id, r.notify_topic]));
  const sent = new Set();
  for (const a of wanted) {
    const ids = a.userIds === 'all' ? [...topics.keys()] : a.userIds;
    for (const id of ids) {
      const key = `${id}|${a.message}`;
      if (!topics.has(id) || isOnline(id) || sent.has(key)) continue;
      sent.add(key);
      await sendAlert(topics.get(id), a.message);
    }
  }
}

class GameController {
  constructor(io) {
    this.io = io;
    this.isOnline = () => false; // index.js wires this to the socket presence map
    this.queue = Promise.resolve();
    this.timer = null;
  }

  // ---- plumbing ---------------------------------------------------------------------------------------

  run(fn) {
    const job = this.queue.then(() => this.transaction(fn));
    this.queue = job.catch(() => {});
    return job;
  }

  async transaction(fn) {
    const client = await pool.connect();
    const t = new GameTx(client);
    let result;
    try {
      await client.query('BEGIN');
      await t.load();
      result = await fn(t);
      if (result?.noop) {
        await client.query('ROLLBACK');
        return { ok: true, ...result };
      }
      await q.updateGame(client, { turn_state: t.ts, decks: t.decks });
      await q.bumpVersion(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const state = await this.getState();
    this.broadcast(state, t);
    sendAlerts(t, this.isOnline).catch(err => console.error('Alert error:', err.message));
    // The events too, so the actor sees their own outcome even while their socket is reconnecting.
    return { ok: true, ...(result || {}), state, events: t.events };
  }

  broadcast(state, t) {
    if (!this.io) return;
    this.io.emit('game:state', state);
    if (t.events.length) this.io.emit('game:events', { version: state.game.version, events: t.events });
    for (const n of t.notices) {
      this.io.to(n.users.map(id => `user:${id}`)).emit(n.name, n.payload);
    }
  }

  // One read-only snapshot, so a commit landing between the three reads can't mix two versions.
  async getState() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const game = await q.getGame(client);
      const players = await q.getAllPlayers(client);
      const properties = await q.getAllProperties(client);
      await client.query('COMMIT');
      return buildState(game, players, properties);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getHistory() {
    const result = await pool.query(
      'SELECT id, started_at, completed_at, winner_user_id, standings FROM game_history ORDER BY completed_at DESC LIMIT 50'
    );
    return result.rows;
  }

  async getLog({ limit, before }) {
    const rows = await q.getActions(pool, { limit, before });
    return rows.map(formatEvent);
  }

  // Skips the turn of a player who let the deadline pass. Runs every minute.
  startTurnTimer() {
    const tick = () => this.checkDeadline()
      .then(() => this.sendReminder())
      .catch(err => console.error('Turn timer error:', err));
    this.timer = setInterval(tick, 60 * 1000);
    tick();
  }

  /**
   * An expired turn is skipped (a pending purchase is declined). A player in debt gets one extra turn period
   * to settle it; after that they are declared bankrupt so one absent player can't stall the game.
   */
  async checkDeadline() {
    const game = await q.getGame();
    if (!game || game.status !== 'in_progress' || !game.turn_deadline) return;
    if (new Date(game.turn_deadline) > new Date()) return;

    await this.run(async (t) => {
      const deadline = t.game.turn_deadline && new Date(t.game.turn_deadline);
      if (t.game.status !== 'in_progress' || !deadline || deadline > new Date()) return { noop: true };
      const me = await q.getPlayerByUserId(t.db, t.game.current_turn_user_id);
      if (t.ts.phase === 'debt') {
        const graceMs = (Number(t.game.settings?.turn_hours) || 0) * 3600 * 1000;
        if (Date.now() < deadline.getTime() + graceMs) return { noop: true };
        return declareBankruptcy(t, me, `${me.username} ran out of time to pay what they owed`);
      }
      // Play the turn for them the way a cautious player would: roll (jail rolls count as attempts), pass on
      // purchases, take doubles re-rolls. Skipping instead would let anyone dodge rent by not showing up.
      await t.log('turn_skipped', me, { reason: 'timeout', autoplayed: true }, `${me.username} ran out of time, so their turn was played for them`);
      for (let i = 0; i < 4 && t.game.current_turn_user_id === me.user_id && t.game.status === 'in_progress'; i++) {
        if (t.ts.phase === 'roll') await playRoll(t, await q.getPlayerById(t.db, me.id));
        else if (t.ts.phase === 'buy') await declinePending(t, me, { timeout: true });
        else if (t.ts.phase === 'end') await turns.advanceTurn(t);
        else break; // debt: the usual grace period applies from the original deadline
      }
      if (t.game.current_turn_user_id === me.user_id && t.ts.phase === 'end') await turns.advanceTurn(t);
    });
  }

  // Half way to the deadline, remind the current player once.
  async sendReminder() {
    const game = await q.getGame();
    if (!game || game.status !== 'in_progress' || !game.turn_deadline) return;
    const hours = Number(game.settings?.turn_hours) || 0;
    const left = new Date(game.turn_deadline).getTime() - Date.now();
    if (hours <= 0 || left <= 0 || left > hours * 3600 * 1000 / 2) return;
    if (turns.normalizeTurnState(game.turn_state).reminded) return;
    await this.run(async (t) => {
      if (t.ts.reminded || t.game.current_turn_user_id !== game.current_turn_user_id) return { noop: true };
      t.ts.reminded = true;
      const me = await q.getPlayerByUserId(t.db, t.game.current_turn_user_id);
      t.alert([me.user_id], `Your turn is waiting: ${Math.max(1, Math.round(left / 3600000))}h left before it is played for you.`);
    });
  }

  // ---- turn actions -----------------------------------------------------------------------------------

  roll(userId) {
    return this.run(async (t) => {
      const me = await requireTurn(t, userId);
      if (t.ts.phase !== 'roll') throw new GameError(phaseReason(t.ts.phase), 409);
      const roll = await playRoll(t, me);
      await finishTurnIfDone(t);
      return { roll };
    });
  }

  buy(userId) {
    return this.run(async (t) => {
      const me = await requireTurn(t, userId);
      if (t.ts.phase !== 'buy') throw new GameError('There is nothing to buy right now', 409);
      const property = await q.getPropertyById(t.db, t.ts.pendingPropertyId);
      if (property && property.owner_id == null) {
        if (me.money < property.purchase_price) {
          throw new GameError(`${property.name} costs $${property.purchase_price} and you have $${me.money}`);
        }
        await q.addMoney(t.db, me.id, -property.purchase_price);
        await q.updateProperty(t.db, property.id, { owner_id: me.id });
        await t.log('buy', me, { propertyId: property.id, price: property.purchase_price },
          `${me.username} bought ${property.name} for $${property.purchase_price}`);
      }
      t.ts.pendingPropertyId = null;
      turns.settle(t.ts);
      await finishTurnIfDone(t);
    });
  }

  decline(userId) {
    return this.run(async (t) => {
      const me = await requireTurn(t, userId);
      if (t.ts.phase !== 'buy') throw new GameError('There is nothing to decline right now', 409);
      await declinePending(t, me);
      await finishTurnIfDone(t);
    });
  }

  payFine(userId) {
    return this.run(async (t) => {
      await jail.payFine(t, await requireTurn(t, userId));
      turns.settle(t.ts);
    });
  }

  useJailCard(userId) {
    return this.run(async (t) => {
      await jail.useCard(t, await requireTurn(t, userId));
      turns.settle(t.ts);
    });
  }

  payDebts(userId) {
    return this.run(async (t) => {
      const me = await requireTurn(t, userId);
      if (t.ts.phase !== 'debt') throw new GameError('You owe nothing', 409);
      const total = t.ts.debts.reduce((sum, d) => sum + d.amount, 0);
      if (me.money < total) throw new GameError(`You owe $${total} and have $${me.money}`);
      const payments = [];
      for (const debt of t.ts.debts) {
        await q.addMoney(t.db, me.id, -debt.amount);
        const creditor = debt.creditorId ? await q.getPlayerById(t.db, debt.creditorId) : null;
        if (creditor && !creditor.is_bankrupt) await q.addMoney(t.db, creditor.id, debt.amount);
        payments.push({ creditorId: creditor?.id ?? null, creditorUserId: creditor?.user_id ?? null, amount: debt.amount, reason: debt.reason, creditorName: creditor?.username ?? 'the bank' });
      }
      const to = payments.map(p => `$${p.amount} to ${p.creditorName}`).join(', ');
      await t.log('debts_paid', me, { amount: total, payments: payments.map(({ creditorName, ...p }) => p) },
        `${me.username} paid what they owed: ${to}`);
      t.ts.debts = [];
      turns.settle(t.ts);
      await finishTurnIfDone(t);
      // Settling late shouldn't make the timer skip the rest of the turn straight away.
      const hours = Number(t.game.settings?.turn_hours) || 0;
      if (hours > 0 && t.game.turn_deadline && new Date(t.game.turn_deadline) < new Date()) {
        t.game = await q.updateGame(t.db, { turn_deadline: new Date(Date.now() + hours * 3600 * 1000) });
      }
    });
  }

  bankrupt(userId) {
    return this.run(async (t) => {
      const me = await requireTurn(t, userId);
      if (t.ts.phase !== 'debt') throw new GameError('You can only declare bankruptcy when you owe more than you can pay', 409);
      await declareBankruptcy(t, me);
    });
  }

  endTurn(userId) {
    return this.run(async (t) => {
      await requireTurn(t, userId);
      if (t.ts.phase !== 'end') throw new GameError(phaseReason(t.ts.phase) === phaseReason('end') ? 'Not now' : phaseReason(t.ts.phase), 409);
      await turns.advanceTurn(t);
    });
  }

  // ---- property management (any time during the game) -------------------------------------------------

  manage(userId, propertyId, action) {
    return this.run(async (t) => {
      const me = await requireActive(t, userId);
      requireInt(propertyId, 'propertyId');
      const all = await q.getAllProperties(t.db);
      const property = all.find(p => p.id === propertyId);
      if (!property) throw new GameError('Property not found', 404);

      if (action === 'build') {
        const cost = rules.checkBuild(me, property, all);
        await q.addMoney(t.db, me.id, -cost);
        const built = await q.updateProperty(t.db, property.id, { house_count: property.house_count + 1 });
        const what = built.house_count === 5 ? 'a hotel' : `house ${built.house_count}`;
        await t.log('build', me, { propertyId: property.id, houseCount: built.house_count, amount: cost },
          `${me.username} built ${what} on ${property.name} for $${cost}`);
      } else if (action === 'sell') {
        const { refund, houseCount } = rules.checkSellBuilding(me, property, all);
        await q.addMoney(t.db, me.id, refund);
        await q.updateProperty(t.db, property.id, { house_count: houseCount });
        const what = property.house_count === 5
          ? (houseCount === 4 ? 'a hotel' : `a hotel (the bank had only ${houseCount} house${houseCount === 1 ? '' : 's'} to put back)`)
          : 'a house';
        await t.log('sell_building', me, { propertyId: property.id, houseCount, amount: refund },
          `${me.username} sold ${what} on ${property.name} for $${refund}`);
      } else if (action === 'mortgage') {
        const value = rules.checkMortgage(me, property, all);
        await q.addMoney(t.db, me.id, value);
        await q.updateProperty(t.db, property.id, { is_mortgaged: true });
        await t.log('mortgage', me, { propertyId: property.id, amount: value }, `${me.username} mortgaged ${property.name} for $${value}`);
      } else if (action === 'unmortgage') {
        const cost = rules.checkUnmortgage(me, property);
        await q.addMoney(t.db, me.id, -cost);
        await q.updateProperty(t.db, property.id, { is_mortgaged: false });
        await t.log('unmortgage', me, { propertyId: property.id, amount: cost }, `${me.username} paid $${cost} to unmortgage ${property.name}`);
      } else {
        throw new GameError('Unknown action');
      }
    });
  }

  // ---- trades -----------------------------------------------------------------------------------------

  tradeAction(userId, fn) {
    return this.run(async (t) => {
      const me = await requireActive(t, userId);
      const trade = await fn(t, me);
      return { trade };
    });
  }

  proposeTrade(userId, body) {
    return this.tradeAction(userId, async (t, me) => {
      const trade = await trades.propose(t, me, body.recipientPlayerId, body);
      await t.log('trade_offer', me, trades.eventData(trade), `${me.username} sent ${trade.recipient_username} a trade offer`);
      return trade;
    });
  }

  acceptTrade(userId, tradeId) {
    return this.tradeAction(userId, (t, me) => trades.accept(t, me, requireInt(tradeId, 'tradeId')));
  }

  rejectTrade(userId, tradeId) {
    return this.tradeAction(userId, (t, me) => trades.reject(t, me, requireInt(tradeId, 'tradeId')));
  }

  cancelTrade(userId, tradeId) {
    return this.tradeAction(userId, (t, me) => trades.cancel(t, me, requireInt(tradeId, 'tradeId')));
  }

  counterTrade(userId, tradeId, body) {
    return this.tradeAction(userId, (t, me) => trades.counter(t, me, requireInt(tradeId, 'tradeId'), body));
  }

  // ---- lobby ------------------------------------------------------------------------------------------

  join(userId) {
    return this.run(async (t) => {
      await requireLobby(t);
      const existing = await q.getPlayerByUserId(t.db, userId);
      if (existing) return { noop: true, player: existing };
      const players = await q.getAllPlayers(t.db);
      if (players.length >= board.MAX_PLAYERS) throw new GameError(`The game is full (${board.MAX_PLAYERS} players)`);
      const color = board.PLAYER_COLORS.find(c => !players.some(p => p.player_color === c)) || 'gray';
      const player = await q.createPlayer(t.db, {
        userId,
        turnOrder: Math.max(0, ...players.map(p => p.turn_order)) + 1,
        color,
        money: Number(t.game.settings?.starting_money) || board.DEFAULT_SETTINGS.starting_money
      });
      await t.log('join', player, {}, `${player.username} joined the lobby`);
      return { player };
    });
  }

  leave(userId) {
    return this.run(async (t) => {
      await requireLobby(t);
      const me = await q.getPlayerByUserId(t.db, userId);
      if (!me) return { noop: true };
      await t.db.query('DELETE FROM players WHERE id = $1', [me.id]);
      await renumberSeats(t.db);
      await t.log('leave', { username: me.username, user_id: me.user_id }, {}, `${me.username} left the lobby`);
    });
  }

  toggleReady(userId) {
    return this.run(async (t) => {
      await requireLobby(t);
      const me = await q.getPlayerByUserId(t.db, userId);
      if (!me) throw new GameError('Join the lobby first', 404);
      const ready = !me.ready_to_start;
      await q.updatePlayer(t.db, me.id, { ready_to_start: ready });
      await t.log('ready', me, { ready }, ready ? `${me.username} is ready` : `${me.username} is not ready`);
      return { ready };
    });
  }

  start(userId) {
    return this.run(async (t) => {
      await requireLobby(t);
      const players = await q.getAllPlayers(t.db);
      const host = players[0];
      if (!host || host.user_id !== userId) throw new GameError(`Only the host${host ? ` (${host.username})` : ''} can start the game`, 403);
      if (players.length < 2) throw new GameError('You need at least 2 players to start');
      const waiting = players.filter(p => !p.ready_to_start).map(p => p.username);
      if (waiting.length) throw new GameError(`Waiting for ${waiting.join(', ')} to be ready`);

      const money = Number(t.game.settings?.starting_money) || board.DEFAULT_SETTINGS.starting_money;
      await t.db.query(
        `UPDATE players SET money = $1, position = 0, is_in_jail = false, jail_turns = 0, get_out_of_jail_cards = 0,
           is_bankrupt = false`, [money]);
      await t.db.query('UPDATE properties SET owner_id = NULL, is_mortgaged = false, house_count = 0');
      await t.db.query("UPDATE trades SET status = 'cancelled' WHERE status = 'pending'");
      t.decks = freshDecks();
      t.game = await q.updateGame(t.db, { status: 'in_progress', started_at: new Date(), completed_at: null, winner_user_id: null });
      await t.log('start', host, {}, `${host.username} started the game with ${players.length} players`);
      await turns.startTurn(t, (await q.getAllPlayers(t.db))[0]);
    });
  }

  removePlayer(userId, playerId) {
    return this.run(async (t) => {
      await requireLobby(t);
      requireInt(playerId, 'playerId');
      const players = await q.getAllPlayers(t.db);
      if (players[0]?.user_id !== userId) throw new GameError('Only the host can remove players', 403);
      const target = players.find(p => p.id === playerId);
      if (!target) throw new GameError('Player not found', 404);
      if (target.user_id === userId) throw new GameError('You cannot remove yourself; leave the lobby instead');
      await t.db.query('DELETE FROM players WHERE id = $1', [target.id]);
      await renumberSeats(t.db);
      await t.log('removed', { username: target.username, user_id: target.user_id }, { removedUserId: target.user_id },
        `${target.username} was removed from the lobby`);
    });
  }

  /**
   * Back to the lobby with everyone's seat kept (they can leave). Anyone who played may do this once the
   * game is over; an admin may do it at any time.
   */
  newGame(user, { admin = false } = {}) {
    return this.run(async (t) => {
      if (!admin && t.game.status !== 'completed') {
        throw new GameError(t.game.status === 'in_progress' ? 'A game is still in progress' : 'The lobby is already open', 409);
      }
      const me = await q.getPlayerByUserId(t.db, user.id);
      if (!admin && !me) throw new GameError('Only players from the last game can start a new one', 403);

      await t.db.query('UPDATE properties SET owner_id = NULL, is_mortgaged = false, house_count = 0');
      await t.db.query('DELETE FROM trades');
      await t.db.query('DELETE FROM game_actions');
      await t.db.query(
        `UPDATE players SET money = $1, position = 0, is_in_jail = false, jail_turns = 0, get_out_of_jail_cards = 0,
           is_bankrupt = false, ready_to_start = false`,
        [Number(t.game.settings?.starting_money) || board.DEFAULT_SETTINGS.starting_money]);
      t.game = await q.updateGame(t.db, {
        status: 'lobby', started_at: null, completed_at: null, current_turn_user_id: null, turn_deadline: null, winner_user_id: null
      });
      t.ts = {};
      t.decks = {};
      await t.log('reset', me || { username: user.username, user_id: user.id }, {}, `${user.username} set up a new game`);
    });
  }

  updateSettings(changes) {
    return this.run(async (t) => {
      const settings = { ...board.DEFAULT_SETTINGS, ...(t.game.settings || {}) };
      if (changes.turn_hours !== undefined) {
        const hours = changes.turn_hours;
        if (!Number.isInteger(hours) || hours < 0 || hours > 168) throw new GameError('turn_hours must be 0 (no limit) to 168');
        settings.turn_hours = hours;
        // Apply it to the running turn too: no timer clears the deadline, a shorter one pulls it in.
        if (t.game.status === 'in_progress') {
          const limit = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000) : null;
          const current = t.game.turn_deadline ? new Date(t.game.turn_deadline) : null;
          t.game = await q.updateGame(t.db, { turn_deadline: limit && current && current < limit ? current : limit });
        }
      }
      t.game = await q.updateGame(t.db, { settings });
    });
  }
}

module.exports = GameController;
