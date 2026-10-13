/**
 * What happens when a token stops on a space: buy offers, rent, taxes, jail and cards (including the
 * moves cards cause, which resolve their own landing). Takes the transaction context `t`.
 */

const q = require('../../db/queries');
const board = require('../board');
const { rollDice } = require('./dice');
const { calculateRent } = require('./property');
const { drawCard } = require('./cards');
const { moveBy, sendToJail } = require('./movement');

const DECK_LABEL = { chance: 'Opportunity', community: 'Community Fund' };

/**
 * opts.diceTotal: the roll that got the player here (utility rent).
 * opts.rentMultiplier: 2 for the "nearest Subway Station" card.
 * opts.utilityMultiplier: 10 for the "nearest Utility" card (rolls fresh dice).
 */
async function resolveLanding(t, player, opts = {}) {
  const depth = opts.depth || 0;
  if (depth > 3) return;

  const property = await q.getPropertyByPosition(t.db, player.position);
  if (property) {
    return landOnProperty(t, player, property, opts);
  }

  const space = board.SPECIAL_SPACES[player.position];
  switch (space?.type) {
    case 'GO_TO_JAIL':
      await sendToJail(t, player, 'go_to_jail');
      return;
    case 'TAX':
      await t.charge(player, space.amount, null, space.name, {
        type: 'tax',
        data: { amount: space.amount, kind: space.kind },
        text: `${player.username} paid $${space.amount} ${space.name}`
      });
      return;
    case 'CHANCE':
    case 'COMMUNITY_CHEST':
      await applyCard(t, player, space.type === 'CHANCE' ? 'chance' : 'community', { ...opts, depth: depth + 1 });
      return;
    default:
      return; // GO (salary is paid while moving), visiting Rikers, Lost and Found
  }
}

async function landOnProperty(t, player, property, opts) {
  if (property.owner_id == null) {
    t.ts.pendingPropertyId = property.id;
    return;
  }
  if (property.owner_id === player.id) return;

  const owner = await q.getPlayerById(t.db, property.owner_id);
  if (property.is_mortgaged) {
    await t.log('rent', player, { propertyId: property.id, amount: 0, ownerId: owner.id, ownerUserId: owner.user_id },
      `${property.name} is mortgaged, so ${player.username} owes ${owner.username} nothing`);
    return;
  }

  let diceTotal = opts.diceTotal ?? null;
  if (property.property_type === 'utility' && opts.utilityMultiplier) {
    const roll = rollDice();
    diceTotal = roll.total;
    await t.log('roll', player, { ...roll, forUtility: true },
      `${player.username} rolled ${roll.die1} + ${roll.die2} = ${roll.total} for the utility bill`);
  }

  const all = await q.getAllProperties(t.db);
  const rent = calculateRent(property, all, {
    diceTotal,
    multiplier: opts.rentMultiplier || 1,
    utilityMultiplier: opts.utilityMultiplier || null
  });
  await t.charge(player, rent, owner.id, `rent for ${property.name}`, {
    type: 'rent',
    data: { propertyId: property.id, amount: rent, ownerId: owner.id, ownerUserId: owner.user_id },
    text: `${player.username} paid $${rent} rent to ${owner.username} for ${property.name}`
  });
}

async function applyCard(t, player, deck, opts) {
  const card = drawCard(t.decks, deck);
  await t.log('card', player, { deck, cardType: card.type, cardText: card.text },
    `${player.username} drew ${DECK_LABEL[deck]}: "${card.text}"`);

  switch (card.type) {
    case 'advance': {
      const moved = await moveBy(t, player, board.stepsForwardTo(player.position, card.position), 'card');
      return resolveLanding(t, moved, { diceTotal: opts.diceTotal, depth: opts.depth });
    }
    case 'nearest': {
      const targets = card.kind === 'railroad' ? board.RAILROADS : board.UTILITIES;
      const target = board.nextOf(targets, player.position);
      const moved = await moveBy(t, player, board.stepsForwardTo(player.position, target), 'card');
      const extra = card.kind === 'railroad' ? { rentMultiplier: 2 } : { utilityMultiplier: 10 };
      return resolveLanding(t, moved, { ...extra, depth: opts.depth });
    }
    case 'back': {
      const moved = await moveBy(t, player, -card.spaces, 'back');
      return resolveLanding(t, moved, { diceTotal: opts.diceTotal, depth: opts.depth });
    }
    case 'jail':
      await sendToJail(t, player, 'card');
      return;
    case 'jail_free':
      await t.db.query('UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + 1 WHERE id = $1', [player.id]);
      return;
    case 'money':
      if (card.amount > 0) {
        const paid = await q.addMoney(t.db, player.id, card.amount);
        await t.log('money', paid, { amount: card.amount, reason: card.text }, `${paid.username} collected $${card.amount}`);
      } else {
        await t.charge(player, -card.amount, null, card.text, {
          type: 'money',
          data: { amount: card.amount, reason: card.text },
          text: `${player.username} paid $${-card.amount}`
        });
      }
      return;
    case 'pay_each': {
      const others = (await q.getAllPlayers(t.db)).filter(p => p.id !== player.id && !p.is_bankrupt);
      await t.chargeMany(player, others.map(o => ({ creditorId: o.id, amount: card.amount })), card.text, {
        type: 'money',
        data: { amount: -card.amount * others.length, reason: card.text },
        text: `${player.username} paid $${card.amount} to each of ${others.length} player${others.length === 1 ? '' : 's'}`
      });
      return;
    }
    case 'collect_each': {
      // Other players are not on their turn, so they pay what they can rather than going into debt.
      const others = (await q.getAllPlayers(t.db)).filter(p => p.id !== player.id && !p.is_bankrupt);
      let total = 0;
      for (const other of others) {
        const payment = Math.max(0, Math.min(other.money, card.amount));
        if (payment > 0) {
          await q.addMoney(t.db, other.id, -payment);
          total += payment;
        }
      }
      const paid = await q.addMoney(t.db, player.id, total);
      await t.log('money', paid, { amount: total, reason: card.text }, `${paid.username} collected $${total} from the other players`);
      return;
    }
    case 'repairs': {
      const owned = (await q.getAllProperties(t.db)).filter(p => p.owner_id === player.id);
      const hotels = owned.filter(p => p.house_count === 5).length;
      const houses = owned.reduce((n, p) => n + (p.house_count < 5 ? p.house_count : 0), 0);
      const cost = houses * card.house + hotels * card.hotel;
      if (cost === 0) {
        await t.log('money', player, { amount: 0, reason: card.text }, `${player.username} has no buildings to repair`);
        return;
      }
      await t.charge(player, cost, null, 'repairs', {
        type: 'money',
        data: { amount: -cost, reason: card.text, houses, hotels },
        text: `${player.username} paid $${cost} for repairs (${houses} house${houses === 1 ? '' : 's'}, ${hotels} hotel${hotels === 1 ? '' : 's'})`
      });
      return;
    }
  }
}

module.exports = { resolveLanding };
