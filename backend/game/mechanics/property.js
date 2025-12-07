/**
 * Property system mechanics for Monopoly
 */

const { updateProperty, updatePlayer, getAllProperties } = require('../../db/queries');

async function canBuyProperty(player, property) {
  return (
    property.owner_id === null &&
    player.money >= property.purchase_price &&
    !player.is_bankrupt &&
    !property.is_mortgaged
  );
}

async function purchaseProperty(player, property) {
  // Provide specific error messages
  if (property.owner_id !== null) {
    throw new Error('Property is already owned');
  }
  if (player.money < property.purchase_price) {
    throw new Error(`Insufficient funds. Need $${property.purchase_price}, have $${player.money}`);
  }
  if (player.is_bankrupt) {
    throw new Error('Cannot purchase property while bankrupt');
  }
  if (property.is_mortgaged) {
    throw new Error('Property is mortgaged');
  }

  // Deduct money from player
  await updatePlayer(player.id, {
    money: player.money - property.purchase_price
  });

  // Assign ownership
  await updateProperty(property.id, {
    ownerId: player.id
  });

  return {
    success: true,
    newMoney: player.money - property.purchase_price
  };
}

async function calculateRent(property, diceRoll = null) {
  if (property.is_mortgaged || property.owner_id === null) {
    return 0;
  }

  // Get all properties to check ownership in groups
  const allProperties = await getAllProperties();

  if (property.property_type === 'property') {
    // Standard property - rent based on house count
    // JSONB fields are already parsed by PostgreSQL/node-postgres
    const rentValues = property.rent_values;
    let rent = rentValues[property.house_count] || rentValues[0];

    // Check if owner owns all properties in color group (doubles rent with no houses)
    if (property.house_count === 0 && property.color_group) {
      const colorGroupProperties = allProperties.filter(
        p => p.color_group === property.color_group
      );
      const ownsAll = colorGroupProperties.every(p => p.owner_id === property.owner_id);

      if (ownsAll) {
        rent = rent * 2; // Double rent for monopoly
      }
    }

    return rent;
  }

  if (property.property_type === 'railroad') {
    // Count how many railroads the owner has
    const railroads = allProperties.filter(
      p => p.property_type === 'railroad' && p.owner_id === property.owner_id
    );
    const count = railroads.length;

    const rentValues = [25, 50, 100, 200];
    return rentValues[count - 1] || 0;
  }

  if (property.property_type === 'utility') {
    // Count how many utilities the owner has
    const utilities = allProperties.filter(
      p => p.property_type === 'utility' && p.owner_id === property.owner_id
    );
    const count = utilities.length;

    // If dice roll provided, use it; otherwise return multiplier
    const multiplier = count === 2 ? 10 : 4;

    if (diceRoll !== null) {
      return multiplier * diceRoll;
    }

    return multiplier; // Return multiplier if no dice roll provided
  }

  return 0;
}

async function payRent(payer, owner, amount) {
  // Deduct from payer
  await updatePlayer(payer.id, {
    money: payer.money - amount
  });

  // Add to owner
  await updatePlayer(owner.id, {
    money: owner.money + amount
  });

  return {
    success: true,
    payerNewMoney: payer.money - amount,
    ownerNewMoney: owner.money + amount
  };
}

/**
 * Check if player can build houses/hotels on a property
 */
async function canBuildOnProperty(player, property) {
  // Can only build on standard properties (not railroads/utilities)
  if (property.property_type !== 'property') {
    return { canBuild: false, reason: 'Cannot build on railroads or utilities' };
  }

  // Must own the property
  if (property.owner_id !== player.id) {
    return { canBuild: false, reason: 'You do not own this property' };
  }

  // Cannot build on mortgaged property
  if (property.is_mortgaged) {
    return { canBuild: false, reason: 'Cannot build on mortgaged property' };
  }

  // Must own all properties in color group (monopoly)
  const allProperties = await getAllProperties();
  const colorGroupProperties = allProperties.filter(
    p => p.color_group === property.color_group && p.property_type === 'property'
  );
  const ownsAll = colorGroupProperties.every(p => p.owner_id === player.id);

  if (!ownsAll) {
    return { canBuild: false, reason: 'Must own all properties in color group' };
  }

  // Cannot build on any property in the group if any are mortgaged
  const anyMortgaged = colorGroupProperties.some(p => p.is_mortgaged);
  if (anyMortgaged) {
    return { canBuild: false, reason: 'Cannot build while any property in group is mortgaged' };
  }

  // Check even building rule - can't have more than 1 house difference
  const houseCounts = colorGroupProperties.map(p => p.house_count);
  const minHouses = Math.min(...houseCounts);

  if (property.house_count > minHouses) {
    return { canBuild: false, reason: 'Must build evenly across color group' };
  }

  // Cannot build more than hotel (5)
  if (property.house_count >= 5) {
    return { canBuild: false, reason: 'Property already has a hotel' };
  }

  return { canBuild: true, colorGroupProperties };
}

/**
 * Purchase houses or hotel for a property
 */
async function purchaseHouses(player, property, count) {
  const buildCheck = await canBuildOnProperty(player, property);

  if (!buildCheck.canBuild) {
    throw new Error(buildCheck.reason);
  }

  // Validate count
  if (count < 1 || count > 5) {
    throw new Error('Can only buy 1-5 houses at a time');
  }

  const newHouseCount = property.house_count + count;
  if (newHouseCount > 5) {
    throw new Error(`Cannot build ${count} houses. Would exceed hotel limit.`);
  }

  // Check even building for each house
  const { colorGroupProperties } = buildCheck;
  const houseCounts = colorGroupProperties.map(p =>
    p.id === property.id ? property.house_count : p.house_count
  );

  for (let i = 0; i < count; i++) {
    const currentCount = property.house_count + i;
    const minInGroup = Math.min(...houseCounts);

    if (currentCount > minInGroup) {
      throw new Error(`Must build evenly. Other properties in group have ${minInGroup} houses.`);
    }

    // Update the count for next iteration
    houseCounts[colorGroupProperties.findIndex(p => p.id === property.id)] = currentCount + 1;
  }

  // Calculate cost
  const costPerHouse = property.house_cost;
  const totalCost = costPerHouse * count;

  if (player.money < totalCost) {
    throw new Error(`Insufficient funds. Need $${totalCost}, have $${player.money}`);
  }

  // Deduct money from player
  await updatePlayer(player.id, {
    money: player.money - totalCost
  });

  // Update property
  await updateProperty(property.id, {
    houseCount: newHouseCount
  });

  return {
    success: true,
    housesAdded: count,
    newHouseCount,
    cost: totalCost,
    newMoney: player.money - totalCost,
    isHotel: newHouseCount === 5
  };
}

module.exports = {
  canBuyProperty,
  purchaseProperty,
  calculateRent,
  payRent,
  canBuildOnProperty,
  purchaseHouses
};
