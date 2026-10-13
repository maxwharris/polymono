// Read-only views over the server's property rows: rent ladders, set progress, net worth. The server stays
// authoritative for every rule; nothing here decides what a player may do.
import { GROUP_ORDER, GROUP_SIZES, groupKey } from './board';
import { money } from './format';

const STREET_TIERS = ['Rent', 'With the full set', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'];

export function ownedCount(ownerId, key, properties) {
  if (ownerId == null) return 0;
  return properties.filter(p => p.owner_id === ownerId && groupKey(p) === key).length;
}

export function ownsFullSet(ownerId, property, properties) {
  const key = groupKey(property);
  return ownerId != null && ownedCount(ownerId, key, properties) === GROUP_SIZES[key];
}

export function unmortgageCost(property) {
  return property.management?.unmortgageCost ?? Math.ceil((property.mortgage_value || 0) * 1.1);
}

/**
 * The rent table for a property and the row that applies right now (-1 when unowned or mortgaged).
 * Streets: rent_values = [base, full set, 1-4 houses, hotel]. Stations: [1..4 owned]. Utilities: [4x, 10x].
 */
export function rentLadder(property, properties) {
  const values = Array.isArray(property.rent_values) ? property.rent_values : [];
  const owner = property.owner_id;
  let rows;
  let current = -1;

  if (property.property_type === 'railroad') {
    rows = values.map((v, i) => ({ label: `${i + 1} station${i ? 's' : ''} owned`, value: money(v) }));
    if (owner != null) current = ownedCount(owner, 'railroad', properties) - 1;
  } else if (property.property_type === 'utility') {
    rows = [
      { label: 'One utility owned', value: `${values[0] ?? 4}× dice` },
      { label: 'Both utilities owned', value: `${values[1] ?? 10}× dice` }
    ];
    if (owner != null) current = ownedCount(owner, 'utility', properties) - 1;
  } else {
    rows = STREET_TIERS.slice(0, Math.max(values.length, 1)).map((label, i) => ({ label, value: money(values[i]) }));
    if (owner != null) {
      if (property.house_count > 0) current = property.house_count + 1;
      else current = ownsFullSet(owner, property, properties) ? 1 : 0;
    }
  }
  if (property.is_mortgaged) current = -1;
  return { rows, current };
}

// What landing here costs now, as text.
export function rentNowLabel(property) {
  if (property.owner_id == null) return null;
  if (property.is_mortgaged) return 'No rent';
  if (property.property_type === 'utility') return `${property.current_rent}× dice`;
  return money(property.current_rent);
}

export function buildingLabel(houseCount) {
  if (!houseCount) return 'No buildings';
  if (houseCount >= 5) return 'Hotel';
  return `${houseCount} house${houseCount === 1 ? '' : 's'}`;
}

// Cash plus property at price (mortgage value if mortgaged) plus buildings at cost.
export function netWorth(player, properties) {
  if (!player || player.is_bankrupt) return 0;
  let worth = player.money || 0;
  for (const p of properties) {
    if (p.owner_id !== player.id) continue;
    worth += p.is_mortgaged ? p.mortgage_value || 0 : p.purchase_price || 0;
    worth += (p.house_count || 0) * (p.house_cost || 0);
  }
  return worth;
}

// [{ key, owned, total, complete }] for every set, in board order.
export function setProgress(playerId, properties) {
  return GROUP_ORDER.map(key => {
    const owned = ownedCount(playerId, key, properties);
    const total = GROUP_SIZES[key];
    return { key, owned, total, complete: owned === total };
  });
}

export function totalOwed(debts) {
  return (debts || []).reduce((sum, d) => sum + (d.amount || 0), 0);
}

// Who inherits a bankrupt player's assets: the one player creditor if every debt is owed to them
// (mirrors the server), otherwise null (the bank).
export function bankruptcyHeir(debts, players) {
  const ids = [...new Set((debts || []).map(d => d.creditorId).filter(Boolean))];
  if (ids.length !== 1 || !(debts || []).every(d => d.creditorId === ids[0])) return null;
  return players.find(p => p.id === ids[0]) || null;
}

// Players ranked for the results screen: active players by net worth, then the bankrupt.
export function standings(players, properties) {
  return players
    .map(p => ({ player: p, worth: netWorth(p, properties) }))
    .sort((a, b) => (a.player.is_bankrupt - b.player.is_bankrupt) || b.worth - a.worth);
}

// A player's properties grouped by set, sets in board order: [{ key, items, owned, total, complete }].
export function groupHoldings(ownerId, properties) {
  return GROUP_ORDER.map(key => {
    const items = properties
      .filter(p => p.owner_id === ownerId && groupKey(p) === key)
      .sort((a, b) => a.position_on_board - b.position_on_board);
    return { key, items, owned: items.length, total: GROUP_SIZES[key], complete: items.length === GROUP_SIZES[key] };
  }).filter(g => g.items.length);
}
