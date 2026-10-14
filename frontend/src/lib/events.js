// Helpers over the server's game events ({ id, type, player_id, user_id, username, data, text, timestamp }):
// feed grouping, "involves me", the away digest and end-of-game stats. The server writes `text` with
// usernames; the feed rewrites a roll and the move it caused as one plain sentence ("jack rolled 4 and 3 and
// landed on Tribeca") and puts lines that involve the viewer in their words ("You bought Tribeca for $200",
// "seabass paid you $25 rent for Tribeca").
import { spaceName } from './board';

// Every event type → a drawn icon (components/ui/Icon names). No emoji anywhere in the UI.
export const EVENT_ICONS = {
  turn: 'play',
  turn_skipped: 'clock',
  roll: 'dice',
  move: 'step',
  salary: 'note',
  buy: 'house',
  decline: 'pass',
  rent: 'note',
  tax: 'note',
  fine: 'note',
  card: 'card',
  money: 'note',
  jail: 'bars',
  jail_release: 'bars',
  jail_stay: 'bars',
  build: 'house',
  sell_building: 'house',
  mortgage: 'bank',
  unmortgage: 'bank',
  debt: 'warning',
  debts_paid: 'check',
  bankrupt: 'close',
  game_over: 'crown',
  join: 'players',
  leave: 'logout',
  ready: 'players',
  start: 'players',
  removed: 'logout',
  reset: 'refresh',
  trade_offer: 'trade',
  trade_accepted: 'trade',
  trade_rejected: 'trade',
  trade_countered: 'trade'
};

/** The Icon name for an event. */
export function eventIcon(event) {
  return EVENT_ICONS[event?.type] || 'info';
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

/** "jack rolled 4 and 3" (plus "(doubles)"), from the roll's data rather than the server's "4 + 3 = 7". */
function rollText(e, subject = e.username || 'Someone') {
  const d = e.data || {};
  if (!d.die1 || !d.die2) return null;
  const doubles = d.isDoubles ? ' (doubles)' : '';
  const utility = d.forUtility ? ' for the utility bill' : '';
  return `${subject} rolled ${d.die1} and ${d.die2}${doubles}${utility}`;
}

// The server's sentences start with the actor's username ("max bought Tribeca for $200"): the rest of it.
function predicate(e) {
  const prefix = `${e.username} `;
  return e.username && e.text?.startsWith(prefix) ? e.text.slice(prefix.length) : null;
}

// For "You": the verb a server sentence starts with, in the second person.
const SECOND_PERSON = [[/^is /, 'are '], [/^was /, 'were '], [/^has /, 'have '], [/^stays /, 'stay '], [/^owes /, 'owe ']];
function asYou(rest) {
  if (rest == null) return null;
  const [re, verb] = SECOND_PERSON.find(([pattern]) => pattern.test(rest)) || [];
  return `You ${re ? rest.replace(re, verb) : rest}`;
}

/**
 * The sentence for one event from the viewer's side: their own actions as "You …", and "you" wherever the
 * event names them as owner, creditor, trade partner or heir. Built from event.type and event.data, with the
 * server's wording; null when the event doesn't involve the viewer, or a name or place can't be resolved,
 * and the server's text stands.
 * ctx: { myUserId, players, properties }.
 */
function viewerText(e, { myUserId, players = [], properties = [] }) {
  const d = e.data || {};
  const self = e.user_id === myUserId;
  const nameOfUser = uid => (uid === myUserId ? 'you' : players.find(p => p.user_id === uid)?.username || null);
  const place = properties.find(p => p.id === d.propertyId)?.name || null;
  const rest = predicate(e);

  switch (e.type) {
    case 'turn':
      return self ? `It's your turn${e.text.endsWith('(in Rikers)') ? ' (in Rikers)' : ''}` : null;
    case 'turn_skipped':
      return self ? 'You ran out of time, so your turn was played for you' : null;
    case 'roll':
      return self ? rollText(e, 'You') : null;
    case 'move':
    case 'salary':
    case 'buy':
    case 'decline':
    case 'tax':
    case 'money':
    case 'card':
    case 'jail':
    case 'jail_release':
    case 'jail_stay':
    case 'build':
    case 'sell_building':
    case 'mortgage':
    case 'unmortgage':
    case 'join':
    case 'leave':
    case 'ready':
    case 'start':
    case 'removed':
    case 'reset':
      return self ? asYou(rest) : null;
    case 'debt':
      // "max owes $450 for rent for Chelsea but has $330: they must raise money or go bankrupt"
      return self && rest ? asYou(rest).replace(' but has $', ' but have $').replace(': they must ', ': you must ') : null;
    case 'game_over':
      return self ? 'You win the game!' : null;
    case 'rent': {
      const owner = nameOfUser(d.ownerUserId);
      if (!(self || owner === 'you') || !owner || !place) return null;
      const payer = self ? 'You' : e.username;
      if (!d.amount) return `${place} is mortgaged, so ${self ? 'you owe' : `${payer} owes`} ${owner} nothing`;
      return `${payer} paid ${owner} $${d.amount} rent for ${place}`;
    }
    case 'debts_paid': {
      const payments = Array.isArray(d.payments) ? d.payments : [];
      const names = payments.map(p => (p.creditorUserId == null ? 'the bank' : nameOfUser(p.creditorUserId)));
      if (!(self || names.includes('you')) || names.some(n => !n)) return null;
      const to = payments.map((p, i) => `$${p.amount} to ${names[i]}`).join(', ');
      return self ? `You paid what you owed: ${to}` : `${e.username} paid what they owed: ${to}`;
    }
    case 'bankrupt': {
      const heirPlayer = d.creditorId != null ? players.find(p => p.id === d.creditorId) : null;
      const heir = heirPlayer ? nameOfUser(heirPlayer.user_id) : null;
      if (!(self || heir === 'you') || (d.creditorId != null && !heir)) return null;
      const subject = self ? 'You' : e.username;
      const their = self ? 'you' : 'they';
      const lead = / ran out of time to pay /.test(e.text) ? `${subject} ran out of time to pay what ${their} owed. ` : '';
      const outcome = heir
        ? `${heir} ${heir === 'you' ? 'take' : 'takes'} everything ${their} had`
        : `${self ? 'your' : 'their'} properties return to the bank`;
      return `${lead}${subject} went bankrupt; ${outcome}`;
    }
    case 'trade_offer':
    case 'trade_countered': {
      // the actor sent the trade's recipient an offer (a counter-offer goes back to the original proposer)
      const to = nameOfUser(d.recipientUserId);
      if (!(self || to === 'you') || !to) return null;
      const what = e.type === 'trade_offer' ? 'a trade offer' : 'a counter-offer';
      return `${self ? 'You' : e.username} sent ${to} ${what}`;
    }
    case 'trade_accepted':
    case 'trade_rejected': {
      // the actor is the recipient, answering the proposer's offer
      const from = nameOfUser(d.proposerUserId);
      if (!(self || from === 'you') || !from) return null;
      const whose = from === 'you' ? 'your' : `${from}'s`;
      const subject = self ? 'You' : e.username;
      if (e.type === 'trade_rejected') return `${subject} turned down ${whose} trade offer`;
      const terms = e.text.split("'s trade: ").slice(1).join("'s trade: ");
      return terms ? `${subject} accepted ${whose} trade: ${terms}` : null;
    }
    default:
      return null;
  }
}

/**
 * The feed sentence for an event. With ctx.myUserId (and ctx.players, ctx.properties) lines that involve the
 * viewer read "You …" / "… you …"; everything else, and any type this doesn't know, is the server's text.
 * Rolls always read "jack rolled 4 and 3".
 */
export function eventText(e, ctx = {}) {
  if (!e?.text) return e?.text ?? null;
  return (ctx.myUserId != null && viewerText(e, ctx)) || (e.type === 'roll' && rollText(e)) || e.text;
}

/**
 * Feed lines: events with text, with a roll and the move it caused folded into one sentence
 * ("jason rolled 6 and 5 and landed on Chelsea"). The jail teleport has no text and is skipped.
 * ctx: { myUserId, players, properties }, for the viewer's own lines (eventText).
 */
export function feedLines(events, ctx = {}) {
  const lines = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e.text) continue;
    const next = events[i + 1];
    if (e.type === 'roll' && next?.type === 'move' && next.player_id === e.player_id && next.data?.kind === 'roll' && rollText(e)) {
      lines.push({ id: e.id, event: e, text: `${eventText(e, ctx)} and landed on ${spaceName(next.data.to)}`, ids: [e.id, next.id] });
      i++;
      continue;
    }
    lines.push({ id: e.id, event: e, text: eventText(e, ctx), ids: [e.id] });
  }
  return lines;
}

/**
 * Groups events into turns: [{ key, kind: 'turn' | 'setup', turn (the 'turn' event or null), lines, lastId,
 * timestamp }], oldest first. A group starts at every 'turn' event; anything before the first one (joins,
 * the start) is 'setup'. ctx goes to feedLines.
 */
export function groupByTurn(events, ctx = {}) {
  const groups = [];
  let current = null;
  let pending = [];
  const flush = () => {
    if (!current) return;
    current.lines = feedLines(pending, ctx);
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
 * Splits a sentence around its dollar amounts, so they can be set as money (Jost 600, tabular):
 * "seabass paid you $25 rent" → [{ text: 'seabass paid you ' }, { money: '$25' }, { text: ' rent' }].
 */
export function splitMoney(text) {
  const parts = [];
  const re = /-?\$\d[\d,]*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text || ''))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ money: m[0] });
    last = m.index + m[0].length;
  }
  if (last < (text || '').length) parts.push({ text: text.slice(last) });
  return parts;
}

/**
 * "While you were away": what happened since `sinceId`, from my point of view.
 */
export function buildDigest(events, sinceId, userId, players, properties) {
  const since = events.filter(e => e.id > sinceId);
  const ctx = { myUserId: userId, players, properties };
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
    if (e.type === 'bankrupt') bankruptcies.push(eventText(e, ctx));
  }
  const mine = feedLines(since, ctx).filter(l => l.event.user_id !== userId && involvesUser(l.event, userId)).slice(-6);
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

/**
 * End-of-game stats from the log: rent collected per player, the biggest single rent, purchases, how many
 * turns were played and when each player went bankrupt.
 */
export function gameStats(events, players) {
  const rentByUser = new Map();
  const buysByUser = new Map();
  const bankruptAt = new Map(); // user id -> timestamp
  let biggest = null;
  let turns = 0;
  for (const e of events) {
    const d = e.data || {};
    if (e.type === 'turn') turns++;
    if (e.type === 'rent' && d.amount > 0) {
      rentByUser.set(d.ownerUserId, (rentByUser.get(d.ownerUserId) || 0) + d.amount);
      if (!biggest || d.amount > biggest.amount) biggest = { amount: d.amount, payer: e.username, ownerUserId: d.ownerUserId };
    }
    if (e.type === 'buy') buysByUser.set(e.user_id, (buysByUser.get(e.user_id) || 0) + 1);
    if (e.type === 'bankrupt' && e.user_id != null) bankruptAt.set(e.user_id, e.timestamp);
  }
  const name = uid => players.find(p => p.user_id === uid)?.username || 'Someone';
  const top = map => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const landlord = top(rentByUser);
  const buyer = top(buysByUser);
  return {
    turns,
    bankruptAt,
    landlord: landlord ? { name: name(landlord[0]), amount: landlord[1] } : null,
    biggestRent: biggest ? { amount: biggest.amount, payer: biggest.payer, owner: name(biggest.ownerUserId) } : null,
    topBuyer: buyer ? { name: name(buyer[0]), count: buyer[1] } : null
  };
}
