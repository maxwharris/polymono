/**
 * Opportunity and Community Fund card mechanics for PolyMono: Manhattan Edition
 */

const { movePlayer } = require('./movement');
const { sendToJail } = require('./jail');
const { updatePlayer } = require('../../db/queries');

const CHANCE_CARDS = [
  { type: 'move', text: "Advance to New Year's Eve (Collect $200)", action: 'position', position: 0 },
  { type: 'move', text: 'Advance to Bryant Park', action: 'position', position: 24 },
  { type: 'move', text: 'Advance to Chelsea', action: 'position', position: 11 },
  { type: 'move', text: 'Advance token to nearest Subway Station. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled', action: 'nearest_railroad' },
  { type: 'move', text: 'Advance token to nearest Subway Station. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled', action: 'nearest_railroad' },
  { type: 'move_back', text: 'Go back three spaces', spaces: 3 },
  { type: 'jail', text: 'Go directly to Rikers Island. Do not pass New Year\'s Eve, do not collect $200', action: 'jail' },
  { type: 'jail_free', text: 'Get out of Rikers Island free. This card may be kept until needed or sold' },
  { type: 'money', text: 'Bank pays you a dividend of $50', amount: 50 },
  { type: 'money', text: 'Speeding fine $15', amount: -15 },
  { type: 'move', text: 'Advance to Times Square Station. If you pass New Year\'s Eve, collect $200', action: 'position', position: 25 },
  { type: 'money', text: 'You have been elected Mayor. Pay each player $50', amount: -50, toAll: true },
  { type: 'money', text: 'Your building loan matures. Collect $150', amount: 150 },
  { type: 'money', text: 'Pay a Jaywalking Fine of $15', amount: -15 },
  { type: 'repairs', text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100', house: 25, hotel: 100 },
  { type: 'move', text: 'Advance to One World Trade Center', action: 'position', position: 39 },
  { type: 'move', text: 'Take a walk on the High Line. Advance to Highline', action: 'position', position: 32 },
  { type: 'move', text: 'Advance to Alphabet City. If you pass New Year\'s Eve, collect $200', action: 'position', position: 1 }
];

const COMMUNITY_CHEST_CARDS = [
  { type: 'move', text: "Time flies... Advance to New Year's Eve (Collect $200)", action: 'position', position: 0 },
  { type: 'money', text: 'Bank error in your favor. Collect $200', amount: 200 },
  { type: 'money', text: 'Doctor\'s fee. Pay $50', amount: -50 },
  { type: 'money', text: 'From sale of stock you get $50', amount: 50 },
  { type: 'jail_free', text: 'Get out of Rikers Island free. This card may be kept until needed or sold' },
  { type: 'jail', text: 'Go directly to Rikers Island. Do not pass New Year\'s Eve, do not collect $200' },
  { type: 'money', text: 'It is your birthday. Collect $10 from every player', amount: 10, fromAll: true },
  { type: 'money', text: 'You inherit a Rent-Controlled Apartment. Collect $100', amount: 100 },
  { type: 'money', text: 'You fell in a pothole! Collect $100', amount: 100 },
  { type: 'money', text: 'It is your birthday. Collect $10 from each player', amount: 10, fromAll: true },
  { type: 'money', text: 'Life insurance matures. Collect $100', amount: 100 },
  { type: 'money', text: 'Pay hospital fees of $100', amount: -100 },
  { type: 'money', text: 'Pay for a private school. Pay $50', amount: -50 },
  { type: 'money', text: 'Receive $25 consultancy fee', amount: 25 },
  { type: 'repairs', text: 'You are assessed for street repairs. $40 per house. $115 per hotel', house: 40, hotel: 115 },
  { type: 'money', text: 'You have won second prize in a Broadway talent contest. Collect $10', amount: 10 },
  { type: 'money', text: 'Pay your Property Tax of $150', amount: -150 }
];

async function drawCard(player, deckType, allPlayers, allProperties) {
  const deck = deckType === 'chance' ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];

  const result = { card, effects: [] };

  switch (card.type) {
    case 'money':
      if (card.toAll) {
        // Pay all other players
        const others = allPlayers.filter(p => p.id !== player.id && !p.is_bankrupt);
        let totalPaid = 0;

        for (const other of others) {
          await updatePlayer(other.id, { money: other.money + Math.abs(card.amount) });
          totalPaid += Math.abs(card.amount);
        }

        await updatePlayer(player.id, { money: player.money - totalPaid });
        result.effects.push({ type: 'paid_all', totalAmount: totalPaid, count: others.length });
      } else if (card.fromAll) {
        // Collect from all other players
        const others = allPlayers.filter(p => p.id !== player.id && !p.is_bankrupt);
        let totalReceived = 0;

        for (const other of others) {
          const payment = Math.min(other.money, card.amount); // Can't pay more than they have
          await updatePlayer(other.id, { money: other.money - payment });
          totalReceived += payment;
        }

        await updatePlayer(player.id, { money: player.money + totalReceived });
        result.effects.push({ type: 'collected_from_all', totalAmount: totalReceived, count: others.length });
      } else {
        await updatePlayer(player.id, { money: player.money + card.amount });
        result.effects.push({ type: 'money_change', amount: card.amount });
      }
      break;

    case 'jail':
      await sendToJail(player);
      result.effects.push({ type: 'sent_to_jail' });
      break;

    case 'jail_free':
      await updatePlayer(player.id, {
        getOutOfJailCards: player.get_out_of_jail_cards + 1
      });
      result.effects.push({ type: 'received_jail_card' });
      break;

    case 'move':
      if (card.action === 'position') {
        // Calculate spaces to move forward to reach target position
        let spacesToMove;
        if (card.position > player.position) {
          // Target is ahead on the board
          spacesToMove = card.position - player.position;
        } else if (card.position < player.position) {
          // Target is behind, need to go around the board
          spacesToMove = 40 - player.position + card.position;
        } else {
          // Already at target position, go around the full board
          spacesToMove = 40;
        }
        const moveResult = await movePlayer(player, spacesToMove);
        result.effects.push({ type: 'moved', ...moveResult });
      } else if (card.action === 'nearest_railroad') {
        // Railroads are at positions 5, 15, 25, 35
        const railroads = [5, 15, 25, 35];
        let nearest = railroads.find(r => r > player.position) || railroads[0];
        const spacesToMove = nearest > player.position
          ? nearest - player.position
          : 40 - player.position + nearest;
        const moveResult = await movePlayer(player, spacesToMove);
        result.effects.push({ type: 'moved', ...moveResult, special: 'nearest_railroad' });
      } else if (card.action === 'nearest_utility') {
        // Utilities are at positions 12, 28
        const utilities = [12, 28];
        let nearest = utilities.find(u => u > player.position) || utilities[0];
        const spacesToMove = nearest > player.position
          ? nearest - player.position
          : 40 - player.position + nearest;
        const moveResult = await movePlayer(player, spacesToMove);
        result.effects.push({ type: 'moved', ...moveResult, special: 'nearest_utility' });
      }
      break;

    case 'move_back':
      const moveResult = await movePlayer(player, -card.spaces);
      result.effects.push({ type: 'moved_back', spaces: card.spaces, ...moveResult });
      break;

    case 'repairs':
      // Calculate repair costs based on houses and hotels
      const ownedProperties = allProperties.filter(p => p.owner_id === player.id);
      let houses = 0;
      let hotels = 0;

      ownedProperties.forEach(prop => {
        if (prop.house_count > 0 && prop.house_count < 5) {
          houses += prop.house_count;
        } else if (prop.house_count === 5) {
          hotels += 1;
        }
      });

      const repairCost = (houses * card.house) + (hotels * card.hotel);
      await updatePlayer(player.id, { money: player.money - repairCost });
      result.effects.push({ type: 'repairs', houses, hotels, totalCost: repairCost });
      break;
  }

  return result;
}

module.exports = {
  drawCard,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS
};
