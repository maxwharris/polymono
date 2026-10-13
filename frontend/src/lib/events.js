// Helpers over the server's game events ({ id, type, player_id, user_id, username, data, text, timestamp }):
// feed grouping, "involves me", the away digest and end-of-game stats. The server writes `text`.
import { spaceName } from './board';

export const EVENT_ICONS = {
  turn: '▶',
  turn_skipped: '⏰',
  roll: '🎲',
  move: '➜',
  salary: '💰',
  buy: '🏠',
  decline: '✋',
  rent: '💸',
  tax: '🧾',
  fine: '💸',
  card: '🎴',
  money: '💵',
  jail: '🚓',
  jail_release: '🔓',
  jail_stay: '🔒',
  build: '🏗️',
  sell_building: '🔨',
  mortgage: '🏦',
  unmortgage: '🏦',
  debt: '⚠️',
  debts_paid: '✅',
  bankrupt: '💥',
  game_over: '🏆',
  join: '👋',
  leave: '🚪',
  ready: '✔',
  start: '🚦',
  removed: '🚪',
  reset: '🔄',
  trade_offer: '🤝',
  trade_accepted: '🤝',
  trade_rejected: '🤝',
  trade_countered: '🤝'
};

export function eventIcon(event) {
  return EVENT_ICONS[event.type] || '•';
}

export function involvesUser(event, userId) {
  if (!userId) return false;
  const d = event.data || {};
  return event.user_id === userId ||
    d.ownerUserId === userId ||
    d.proposerUserId === userId ||
    d.recipientUserId === userId ||
    d.winnerUserId === userId ||
    (Array.isArray(d.payments) && d.payments.some(p => p.creditorUserId === userId)); // debts_paid to me
}

// Events others did since `sinceId` that have something to show.
export function unseenEvents(events, sinceId, userId) {
  if (sinceId == null) return [];
  return events.filter(e => e.id > sinceId && e.text && e.user_id !== userId);
}

/**
 * Feed lines: events with text, with a roll and the move it caused folded into one line
 * ("rolled 4 + 3 = 7 → Chinatown"). The jail teleport has no text and is skipped by the server's design.
 */
function feedLines(events) {
  const lines = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e.text) continue;
    const next = events[i + 1];
    if (e.type === 'roll' && next?.type === 'move' && next.player_id === e.player_id && next.data?.kind === 'roll') {
      lines.push({ id: e.id, event: e, text: `${e.text} → ${spaceName(next.data.to)}`, ids: [e.id, next.id] });
      i++;
      continue;
    }
    lines.push({ id: e.id, event: e, text: e.text, ids: [e.id] });
  }
  return lines;
}

/**
 * Groups events into turns: [{ key, kind: 'turn' | 'setup', turn (the 'turn' event or null), lines, lastId,
 * timestamp }], oldest first. A group starts at every 'turn' event; anything before the first one (joins,
 * the start) is 'setup'.
 */
export function groupByTurn(events) {
  const groups = [];
  let current = null;
  let pending = [];
  const flush = () => {
    if (!current) return;
    current.lines = feedLines(pending);
    current.lastId = pending.length ? pending[pending.length - 1].id : current.key;
    if (current.lines.length || current.turn) groups.push(current);
  };
  for (const e of events) {
    if (e.type === 'turn' || !current) {
      flush();
      current = { key: e.id, kind: e.type === 'turn' ? 'turn' : 'setup', turn: e.type === 'turn' ? e : null, lines: [], timestamp: e.timestamp };
      pending = e.type === 'turn' ? [] : [e];
      continue;
    }
    pending.push(e);
  }
  flush();
  return groups;
}

/**
 * "While you were away": what happened since `sinceId`, from my point of view.
 */
export function buildDigest(events, sinceId, userId, players, properties) {
  const since = events.filter(e => e.id > sinceId);
  const propertyName = id => properties.find(p => p.id === id)?.name || 'a property';
  let rentIn = 0;
  let rentOut = 0;
  const purchases = [];
  const tradesForMe = [];
  const bankruptcies = [];
  let turns = 0;
  for (const e of since) {
    const d = e.data || {};
    if (e.type === 'turn') turns++;
    if (e.type === 'rent' && d.amount) {
      if (userId && d.ownerUserId === userId) rentIn += d.amount;
      if (userId && e.user_id === userId) rentOut += d.amount;
    }
    if (e.type === 'buy' && e.user_id !== userId) purchases.push(`${e.username} bought ${propertyName(d.propertyId)}`);
    if ((e.type === 'trade_offer' || e.type === 'trade_countered') && userId && d.recipientUserId === userId) tradesForMe.push(e);
    if (e.type === 'bankrupt') bankruptcies.push(e.text);
  }
  const mine = since.filter(e => e.text && e.user_id !== userId && involvesUser(e, userId)).slice(-6);
  return {
    count: since.filter(e => e.text).length,
    turns,
    rentIn,
    rentOut,
    purchases,
    tradesForMe: tradesForMe.length,
    bankruptcies,
    inJail: players.filter(p => p.is_in_jail && !p.is_bankrupt).map(p => p.username),
    highlights: mine
  };
}

/** End-of-game stats from the log: rent collected per player, the biggest single rent, purchases. */
export function gameStats(events, players) {
  const rentByUser = new Map();
  const buysByUser = new Map();
  let biggest = null;
  for (const e of events) {
    const d = e.data || {};
    if (e.type === 'rent' && d.amount > 0) {
      rentByUser.set(d.ownerUserId, (rentByUser.get(d.ownerUserId) || 0) + d.amount);
      if (!biggest || d.amount > biggest.amount) biggest = { amount: d.amount, payer: e.username, ownerUserId: d.ownerUserId };
    }
    if (e.type === 'buy') buysByUser.set(e.user_id, (buysByUser.get(e.user_id) || 0) + 1);
  }
  const name = uid => players.find(p => p.user_id === uid)?.username || 'Someone';
  const top = map => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const landlord = top(rentByUser);
  const buyer = top(buysByUser);
  return {
    landlord: landlord ? { name: name(landlord[0]), amount: landlord[1] } : null,
    biggestRent: biggest ? { amount: biggest.amount, payer: biggest.payer, owner: name(biggest.ownerUserId) } : null,
    topBuyer: buyer ? { name: name(buyer[0]), count: buyer[1] } : null
  };
}
