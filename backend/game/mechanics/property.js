/**
 * Property rules: rent, building, selling and mortgaging. Pure functions over property rows.
 */

const { RAILROAD_RENT, HOUSE_SUPPLY, HOTEL_SUPPLY } = require('../board');
const { GameError } = require('../errors');

function groupOf(property, allProperties) {
  return allProperties.filter(p => p.property_type === 'property' && p.color_group === property.color_group);
}

function ownsWholeGroup(ownerId, property, allProperties) {
  return ownerId != null && groupOf(property, allProperties).every(p => p.owner_id === ownerId);
}

/**
 * Rent owed for landing on `property`. rent_values for streets is [base, full set, 1-4 houses, hotel].
 * Utilities return multiplier * diceTotal; with no diceTotal they return the multiplier itself.
 * `multiplier` doubles railroad rent for the "nearest Subway Station" card.
 */
function calculateRent(property, allProperties, { diceTotal = null, multiplier = 1, utilityMultiplier = null } = {}) {
  if (property.owner_id == null || property.is_mortgaged) return 0;

  if (property.property_type === 'property') {
    const rents = property.rent_values;
    if (property.house_count > 0) return rents[property.house_count + 1];
    return ownsWholeGroup(property.owner_id, property, allProperties) ? rents[1] : rents[0];
  }

  if (property.property_type === 'railroad') {
    const owned = allProperties.filter(p => p.property_type === 'railroad' && p.owner_id === property.owner_id).length;
    return (RAILROAD_RENT[owned - 1] || 0) * multiplier;
  }

  if (property.property_type === 'utility') {
    const owned = allProperties.filter(p => p.property_type === 'utility' && p.owner_id === property.owner_id).length;
    const m = utilityMultiplier || (owned === 2 ? 10 : 4);
    return diceTotal == null ? m : m * diceTotal;
  }

  return 0;
}

function buildingSupply(allProperties) {
  let houses = 0;
  let hotels = 0;
  for (const p of allProperties) {
    if (p.house_count === 5) hotels++;
    else houses += p.house_count || 0;
  }
  return { houses: HOUSE_SUPPLY - houses, hotels: HOTEL_SUPPLY - hotels };
}

function assertOwner(player, property) {
  if (property.owner_id !== player.id) throw new GameError(`You do not own ${property.name}`);
}

/** Throws unless one more house (or the hotel) can go on `property`. Returns the cost. */
function checkBuild(player, property, allProperties) {
  if (property.property_type !== 'property') throw new GameError('You can only build on streets');
  assertOwner(player, property);
  const group = groupOf(property, allProperties);
  if (!group.every(p => p.owner_id === player.id)) throw new GameError(`You need every ${property.color_group} property to build`);
  if (group.some(p => p.is_mortgaged)) throw new GameError('Unmortgage the whole color group before building');
  if (property.house_count >= 5) throw new GameError(`${property.name} already has a hotel`);
  const min = Math.min(...group.map(p => p.house_count));
  if (property.house_count > min) throw new GameError('Build evenly: add to the properties with fewer houses first');

  const supply = buildingSupply(allProperties);
  if (property.house_count === 4 && supply.hotels <= 0) throw new GameError('The bank has no hotels left');
  if (property.house_count < 4 && supply.houses <= 0) throw new GameError('The bank has no houses left');
  if (player.money < property.house_cost) throw new GameError(`You need $${property.house_cost} to build here`);
  return property.house_cost;
}

/**
 * Throws unless a building can be sold from `property`. Returns { refund, houseCount } (the new count).
 * Breaking a hotel puts four houses back on the board; if the bank has fewer, the hotel comes down to as
 * many houses as it has (possibly none) and every building removed is refunded.
 */
function checkSellBuilding(player, property, allProperties) {
  assertOwner(player, property);
  if (!property.house_count) throw new GameError(`${property.name} has no buildings`);
  const group = groupOf(property, allProperties);
  const max = Math.max(...group.map(p => p.house_count));
  if (property.house_count < max) throw new GameError('Sell evenly: remove from the properties with more houses first');
  const houseCount = property.house_count === 5
    ? Math.min(4, buildingSupply(allProperties).houses)
    : property.house_count - 1;
  return { refund: (property.house_count - houseCount) * Math.floor(property.house_cost / 2), houseCount };
}

function checkMortgage(player, property, allProperties) {
  assertOwner(player, property);
  if (property.is_mortgaged) throw new GameError(`${property.name} is already mortgaged`);
  if (property.property_type === 'property' && groupOf(property, allProperties).some(p => p.house_count > 0)) {
    throw new GameError('Sell the buildings in this color group first');
  }
  return property.mortgage_value;
}

function unmortgageCost(property) {
  return Math.ceil(property.mortgage_value * 1.1);
}

function checkUnmortgage(player, property) {
  assertOwner(player, property);
  if (!property.is_mortgaged) throw new GameError(`${property.name} is not mortgaged`);
  const cost = unmortgageCost(property);
  if (player.money < cost) throw new GameError(`You need $${cost} to unmortgage ${property.name}`);
  return cost;
}

module.exports = {
  groupOf,
  ownsWholeGroup,
  calculateRent,
  buildingSupply,
  checkBuild,
  checkSellBuilding,
  checkMortgage,
  checkUnmortgage,
  unmortgageCost
};
