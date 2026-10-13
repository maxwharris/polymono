/**
 * Trades between players. Every function takes the transaction context `t` (see gameController.js), so
 * validation and execution see the same locked state.
 */

const q = require('../../db/queries');
const tq = require('../../db/tradeQueries');
const { groupOf } = require('./property');
const { GameError } = require('../errors');

const MAX_AMOUNT = 1000000;

function count(value, field) {
  const v = value ?? 0;
  if (!Number.isInteger(v) || v < 0 || v > MAX_AMOUNT) {
    throw new GameError(`${field} must be a whole number of 0 or more`);
  }
  return v;
}

function propertyList(value, field) {
  const list = value ?? [];
  if (!Array.isArray(list) || !list.every(id => Number.isInteger(id) && id > 0)) {
    throw new GameError(`${field} must be a list of property ids`);
  }
  if (new Set(list).size !== list.length) throw new GameError(`${field} lists a property twice`);
  return list;
}

// Terms are always written from the proposer's side: offered = what the proposer gives.
function parseTerms(body = {}) {
  const terms = {
    offeredProperties: propertyList(body.offeredProperties, 'offeredProperties'),
    offeredMoney: count(body.offeredMoney, 'offeredMoney'),
    offeredJailCards: count(body.offeredJailCards, 'offeredJailCards'),
    requestedProperties: propertyList(body.requestedProperties, 'requestedProperties'),
    requestedMoney: count(body.requestedMoney, 'requestedMoney'),
    requestedJailCards: count(body.requestedJailCards, 'requestedJailCards')
  };
  const empty = !terms.offeredProperties.length && !terms.offeredMoney && !terms.offeredJailCards &&
    !terms.requestedProperties.length && !terms.requestedMoney && !terms.requestedJailCards;
  if (empty) throw new GameError('A trade needs at least one item');
  return terms;
}

function termsOf(trade) {
  return {
    offeredProperties: trade.offered_properties || [],
    offeredMoney: trade.offered_money,
    offeredJailCards: trade.offered_jail_cards,
    requestedProperties: trade.requested_properties || [],
    requestedMoney: trade.requested_money,
    requestedJailCards: trade.requested_jail_cards
  };
}

/**
 * A player who owes more than they have (the current player, in the debt phase) may not move value out of
 * reach of their creditors: no cash or jail cards out, and properties only for at least their mortgage value.
 */
function checkDebtor(t, party, gives, gets, allProperties) {
  if (!t.ts.debts.length || t.game.current_turn_user_id !== party.user_id) return;
  if (gives.money > 0 || gives.cards > 0) {
    throw new GameError(`${party.username} owes money and cannot give away cash or jail cards until it is paid`);
  }
  const floor = gives.properties.reduce((sum, id) => sum + (allProperties.find(p => p.id === id)?.mortgage_value || 0), 0);
  if (gets.money < floor) {
    throw new GameError(`${party.username} owes money, so their properties must sell for at least their mortgage value ($${floor})`);
  }
}

function checkSide(owner, ids, allProperties, verb) {
  for (const id of ids) {
    const property = allProperties.find(p => p.id === id);
    if (!property) throw new GameError(`Property ${id} does not exist`);
    if (property.owner_id !== owner.id) throw new GameError(`${owner.username} does not own ${property.name}`);
    if (property.is_mortgaged) throw new GameError(`${property.name} is mortgaged and cannot be ${verb}`);
    if (property.property_type === 'property' && groupOf(property, allProperties).some(p => p.house_count > 0)) {
      throw new GameError(`Sell the buildings in the ${property.color_group} group before trading ${property.name}`);
    }
  }
}

/**
 * Throws unless the trade could happen right now. `requireRecipientFunds` is false when an offer is
 * made (the recipient may have the money by the time they accept) and true on accept.
 */
async function validate(t, proposer, recipient, terms, { requireRecipientFunds }) {
  if (t.game.status !== 'in_progress') throw new GameError('Trades are only possible during a game', 409);
  if (!recipient) throw new GameError('That player is not in the game', 404);
  if (proposer.id === recipient.id) throw new GameError('You cannot trade with yourself');
  if (proposer.is_bankrupt || recipient.is_bankrupt) throw new GameError('Bankrupt players cannot trade');

  const all = await q.getAllProperties(t.db);
  checkSide(proposer, terms.offeredProperties, all, 'traded');
  checkSide(recipient, terms.requestedProperties, all, 'traded');
  const offered = { properties: terms.offeredProperties, money: terms.offeredMoney, cards: terms.offeredJailCards };
  const requested = { properties: terms.requestedProperties, money: terms.requestedMoney, cards: terms.requestedJailCards };
  checkDebtor(t, proposer, offered, requested, all);
  checkDebtor(t, recipient, requested, offered, all);

  if (proposer.money < terms.offeredMoney) throw new GameError(`${proposer.username} only has $${proposer.money}`);
  if (proposer.get_out_of_jail_cards < terms.offeredJailCards) throw new GameError(`${proposer.username} does not have that many jail cards`);
  if (requireRecipientFunds) {
    if (recipient.money < terms.requestedMoney) throw new GameError(`${recipient.username} only has $${recipient.money}`);
    if (recipient.get_out_of_jail_cards < terms.requestedJailCards) throw new GameError(`${recipient.username} does not have that many jail cards`);
  }
  return all;
}

function describe(terms, all, side) {
  const ids = side === 'offered' ? terms.offeredProperties : terms.requestedProperties;
  const money = side === 'offered' ? terms.offeredMoney : terms.requestedMoney;
  const cards = side === 'offered' ? terms.offeredJailCards : terms.requestedJailCards;
  const parts = ids.map(id => all.find(p => p.id === id)?.name).filter(Boolean);
  if (money) parts.push(`$${money}`);
  if (cards) parts.push(`${cards} jail card${cards === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

function eventData(trade) {
  return {
    tradeId: trade.id,
    proposerId: trade.proposer_id,
    recipientId: trade.recipient_id,
    proposerUserId: trade.proposer_user_id,
    recipientUserId: trade.recipient_user_id
  };
}

async function propose(t, proposer, recipientPlayerId, body, counteredFrom = null) {
  const terms = parseTerms(body);
  if (!Number.isInteger(recipientPlayerId)) throw new GameError('recipientPlayerId must be a player id');
  const recipient = await q.getPlayerById(t.db, recipientPlayerId);
  await validate(t, proposer, recipient, terms, { requireRecipientFunds: false });
  const trade = await tq.createTrade(t.db, { proposerId: proposer.id, recipientId: recipient.id, terms, counteredFrom });
  t.notify('trade:changed', trade);
  return trade;
}

function assertPending(trade) {
  if (!trade) throw new GameError('Trade not found', 404);
  if (trade.status !== 'pending') throw new GameError(`This trade is already ${trade.status}`, 409);
}

async function accept(t, recipient, tradeId) {
  const trade = await tq.getTradeById(t.db, tradeId);
  assertPending(trade);
  if (trade.recipient_id !== recipient.id) throw new GameError('Only the player who received this offer can accept it', 403);

  const proposer = await q.getPlayerById(t.db, trade.proposer_id);
  const terms = termsOf(trade);
  let all;
  try {
    all = await validate(t, proposer, recipient, terms, { requireRecipientFunds: true });
  } catch (err) {
    // Ownership changed since the offer was made: the trade can never happen. (Mortgages and buildings
    // can be undone, so those only block it for now.)
    if (/does not own|does not exist/.test(err.message)) {
      await tq.setTradeStatus(t.db, trade.id, 'expired');
      t.notify('trade:changed', trade);
    }
    throw err;
  }

  for (const id of terms.offeredProperties) await q.updateProperty(t.db, id, { owner_id: recipient.id });
  for (const id of terms.requestedProperties) await q.updateProperty(t.db, id, { owner_id: proposer.id });
  const net = terms.requestedMoney - terms.offeredMoney;
  if (net) {
    await q.addMoney(t.db, proposer.id, net);
    await q.addMoney(t.db, recipient.id, -net);
  }
  const cards = terms.requestedJailCards - terms.offeredJailCards;
  if (cards) {
    await t.db.query('UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + $2 WHERE id = $1', [proposer.id, cards]);
    await t.db.query('UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards - $2 WHERE id = $1', [recipient.id, cards]);
  }

  const done = await tq.setTradeStatus(t.db, trade.id, 'accepted');
  await t.log('trade_accepted', recipient, eventData(done),
    `${recipient.username} accepted ${proposer.username}'s trade: ${describe(terms, all, 'offered')} for ${describe(terms, all, 'requested')}`);
  t.notify('trade:changed', done);
  await expireImpossibleTrades(t);
  return done;
}

async function reject(t, recipient, tradeId) {
  const trade = await tq.getTradeById(t.db, tradeId);
  assertPending(trade);
  if (trade.recipient_id !== recipient.id) throw new GameError('Only the player who received this offer can reject it', 403);
  const done = await tq.setTradeStatus(t.db, trade.id, 'rejected');
  await t.log('trade_rejected', recipient, eventData(done), `${recipient.username} turned down ${trade.proposer_username}'s trade offer`);
  t.notify('trade:changed', done);
  return done;
}

async function cancel(t, proposer, tradeId) {
  const trade = await tq.getTradeById(t.db, tradeId);
  assertPending(trade);
  if (trade.proposer_id !== proposer.id) throw new GameError('Only the player who made this offer can cancel it', 403);
  const done = await tq.setTradeStatus(t.db, trade.id, 'cancelled');
  t.notify('trade:changed', done);
  return done;
}

// The recipient answers with new terms (from their own side). The original is closed and a new offer goes back.
async function counter(t, recipient, tradeId, body) {
  const trade = await tq.getTradeById(t.db, tradeId);
  assertPending(trade);
  if (trade.recipient_id !== recipient.id) throw new GameError('Only the player who received this offer can counter it', 403);
  const created = await propose(t, recipient, trade.proposer_id, body, trade.id);
  await tq.setTradeStatus(t.db, trade.id, 'countered');
  await t.log('trade_countered', recipient, eventData(created), `${recipient.username} sent ${trade.proposer_username} a counter-offer`);
  return created;
}

// After properties change hands, pending offers that reference them can never complete.
async function expireImpossibleTrades(t) {
  const all = await q.getAllProperties(t.db);
  const owner = id => all.find(p => p.id === id)?.owner_id;
  for (const trade of await tq.getPendingTrades(t.db)) {
    const ok = (trade.offered_properties || []).every(id => owner(id) === trade.proposer_id) &&
      (trade.requested_properties || []).every(id => owner(id) === trade.recipient_id);
    if (!ok) {
      const expired = await tq.setTradeStatus(t.db, trade.id, 'expired');
      t.notify('trade:changed', expired);
    }
  }
}

module.exports = { propose, accept, reject, cancel, counter, expireImpossibleTrades, eventData };
