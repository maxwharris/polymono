// Pure helpers for trades. The server is authoritative; these only explain in advance what it will refuse.
import { GROUP_LABELS, PROPERTY_COLORS, groupKey } from '../../lib/board';
import { money } from '../../lib/format';

export const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  countered: 'Countered',
  expired: 'Expired'
};

export function propertyColor(property) {
  return (property && PROPERTY_COLORS[groupKey(property)]) || '#8A9A92';
}

function idList(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isInteger);
  if (typeof value === 'string') {
    try {
      return idList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export function emptySide() {
  return { properties: [], money: 0, jailCards: 0 };
}

export function isEmptySide(side) {
  return !side.properties.length && !side.money && !side.jailCards;
}

// One side of a trade row: 'offered' is what the proposer gives, 'requested' what they ask for.
export function tradeSide(trade, which) {
  return {
    properties: idList(trade[`${which}_properties`]),
    money: Number(trade[`${which}_money`]) || 0,
    jailCards: Number(trade[`${which}_jail_cards`]) || 0
  };
}

// The trade from my point of view: what I give, what I get, and who the other player is.
export function fromMySide(trade, myUserId) {
  const iProposed = trade.proposer_user_id === myUserId;
  const offered = tradeSide(trade, 'offered');
  const requested = tradeSide(trade, 'requested');
  return {
    iProposed,
    give: iProposed ? offered : requested,
    get: iProposed ? requested : offered,
    other: iProposed
      ? { playerId: trade.recipient_id, userId: trade.recipient_user_id, username: trade.recipient_username }
      : { playerId: trade.proposer_id, userId: trade.proposer_user_id, username: trade.proposer_username }
  };
}

// Why a property cannot be traded right now (mirrors the server's checks), or null.
export function untradableReason(property, properties) {
  if (!property) return 'Unknown property';
  if (property.is_mortgaged) return 'Mortgaged';
  if (property.property_type === 'property') {
    const group = properties.filter(p => p.property_type === 'property' && p.color_group === property.color_group);
    if (group.some(p => p.house_count > 0)) {
      return property.house_count > 0 ? 'Has buildings' : `Buildings on the ${(GROUP_LABELS[property.color_group] || property.color_group).toLowerCase()} set`;
    }
  }
  return null;
}

// "Red", "Light blue", "Subway station", "Utility": the line under a property's name on a deed chip.
export function groupName(property) {
  if (!property) return '';
  if (property.property_type === 'railroad') return 'Subway station';
  if (property.property_type === 'utility') return 'Utility';
  return GROUP_LABELS[property.color_group] || property.color_group || '';
}

/**
 * The colour sets I would complete by this trade (group keys), counting what I give away: sets I already
 * own in full are not news. Stations and utilities are not "sets" here.
 */
export function completedSets(give, get, { properties, myPlayerId }) {
  if (myPlayerId == null || !get.properties.length) return [];
  const after = new Set(properties.filter(p => p.owner_id === myPlayerId).map(p => p.id));
  for (const id of give.properties) after.delete(id);
  for (const id of get.properties) after.add(id);
  const groups = new Set();
  for (const id of get.properties) {
    const property = properties.find(p => p.id === id);
    if (property?.property_type === 'property') groups.add(property.color_group);
  }
  const done = [];
  for (const group of groups) {
    const members = properties.filter(p => p.property_type === 'property' && p.color_group === group);
    if (!members.length) continue;
    const before = members.every(p => p.owner_id === myPlayerId);
    if (!before && members.every(p => after.has(p.id))) done.push(group);
  }
  return done;
}

export function jailCardText(count) {
  return `${count} Get Out of Jail Free card${count === 1 ? '' : 's'}`;
}

export function describeSide(side, byId) {
  const parts = side.properties.map(id => byId.get(id)?.name || `Property ${id}`);
  if (side.money) parts.push(money(side.money));
  if (side.jailCards) parts.push(jailCardText(side.jailCards));
  return parts.length ? parts.join(', ') : 'nothing';
}


/**
 * Reasons this pending trade cannot go through right now, phrased for me. Ownership changes make the
 * server expire a trade; mortgages, buildings and cash only block it until they are sorted out.
 */
export function tradeProblems(trade, { byId, properties, players, myPlayerId }) {
  const problems = [];
  const proposer = players.find(p => p.id === trade.proposer_id);
  const recipient = players.find(p => p.id === trade.recipient_id);
  const who = player => (player?.id === myPlayerId ? 'You' : player?.username || 'They');

  const check = (ids, owner) => {
    for (const id of ids) {
      const property = byId.get(id);
      if (!property) continue;
      if (property.owner_id !== owner?.id) {
        problems.push(`${property.name} has changed hands.`);
        continue;
      }
      const reason = untradableReason(property, properties);
      if (reason === 'Mortgaged') problems.push(`${property.name} is mortgaged.`);
      else if (reason) problems.push(`${property.name}: sell the buildings on its set first.`);
    }
  };

  const offered = tradeSide(trade, 'offered');
  const requested = tradeSide(trade, 'requested');
  check(offered.properties, proposer);
  check(requested.properties, recipient);

  for (const [player, side] of [[proposer, offered], [recipient, requested]]) {
    if (!player) continue;
    if (player.is_bankrupt) problems.push(`${player.username} is bankrupt.`);
    if (side.money > player.money) {
      problems.push(`${who(player)} ${who(player) === 'You' ? 'have' : 'has'} only ${money(player.money)} of the ${money(side.money)}.`);
    }
    if (side.jailCards > (player.get_out_of_jail_cards || 0)) {
      problems.push(`${who(player)} ${who(player) === 'You' ? "don't" : "doesn't"} have ${jailCardText(side.jailCards)}.`);
    }
  }
  return problems;
}

// Money typed into a field: digits only, no leading zeros, clamped to 0..max.
export function parseAmount(raw, max) {
  const digits = String(raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
  if (!digits) return 0;
  return Math.max(0, Math.min(Number(digits), Math.max(0, max)));
}

/**
 * What had to change when a received offer was turned into a counter-offer: properties that can no
 * longer be traded are left out and cash is capped at what each side has. Shown once, so the counter
 * never silently differs from the offer it answers.
 */
export function prefillAdjustments(initial, { me, partner, properties, byId }) {
  const notes = [];
  const check = (side, owner, isMe) => {
    if (!side) return;
    const name = isMe ? 'You' : owner?.username || 'They';
    for (const id of side.properties) {
      const property = byId.get(id);
      if (!property) continue;
      if (property.owner_id !== owner?.id) {
        notes.push(`${property.name} has changed hands, so it was left out.`);
        continue;
      }
      const reason = untradableReason(property, properties);
      if (reason) notes.push(`${property.name} cannot be traded right now (${reason[0].toLowerCase()}${reason.slice(1)}), so it was left out.`);
    }
    if (owner && side.money > owner.money) {
      notes.push(`${name} ${isMe ? 'have' : 'has'} only ${money(owner.money)}, so the cash went from ${money(side.money)} to ${money(Math.max(0, owner.money))}.`);
    }
    const cards = owner?.get_out_of_jail_cards || 0;
    if (owner && side.jailCards > cards) {
      notes.push(`${name} ${isMe ? 'have' : 'has'} ${cards} jail card${cards === 1 ? '' : 's'}, so fewer are included.`);
    }
  };
  check(initial.give, me, true);
  check(initial.get, partner, false);
  return notes;
}
