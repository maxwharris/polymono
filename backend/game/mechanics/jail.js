/**
 * Rikers (jail). Takes the transaction context `t` (see gameController.js).
 *
 * Before rolling, a jailed player may pay $50 or use a Get Out of Jail Free card and then roll normally.
 * Otherwise they roll for doubles: doubles frees them and they move by that roll (no extra roll);
 * the third failed attempt makes them pay $50 and move by that roll anyway.
 */

const q = require('../../db/queries');
const { JAIL_FINE, MAX_JAIL_ATTEMPTS } = require('../board');
const { returnJailCard } = require('./cards');
const { GameError } = require('../errors');

function assertCanLeaveBeforeRolling(t, player) {
  if (!player.is_in_jail) throw new GameError('You are not in Rikers');
  if (t.ts.phase !== 'roll' || t.ts.rolled) throw new GameError('You can only do that before rolling', 409);
}

async function payFine(t, player) {
  assertCanLeaveBeforeRolling(t, player);
  if (player.money < JAIL_FINE) throw new GameError(`You need $${JAIL_FINE} to pay the fine`);
  await q.addMoney(t.db, player.id, -JAIL_FINE);
  const freed = await q.updatePlayer(t.db, player.id, { is_in_jail: false, jail_turns: 0 });
  await t.log('jail_release', freed, { method: 'fine', amount: JAIL_FINE }, `${freed.username} paid $${JAIL_FINE} to leave Rikers`);
  return freed;
}

async function useCard(t, player) {
  assertCanLeaveBeforeRolling(t, player);
  if (player.get_out_of_jail_cards < 1) throw new GameError('You have no Get Out of Jail Free card');
  const freed = await q.updatePlayer(t.db, player.id, {
    is_in_jail: false,
    jail_turns: 0,
    get_out_of_jail_cards: player.get_out_of_jail_cards - 1
  });
  returnJailCard(t.decks);
  await t.log('jail_release', freed, { method: 'card' }, `${freed.username} used a Get Out of Jail Free card`);
  return freed;
}

/**
 * Handles a roll made from jail. Returns the player if they leave (and must move by the roll), or null
 * if they stay in.
 */
async function rollFromJail(t, player, roll) {
  if (roll.isDoubles) {
    const freed = await q.updatePlayer(t.db, player.id, { is_in_jail: false, jail_turns: 0 });
    await t.log('jail_release', freed, { method: 'doubles' }, `${freed.username} rolled doubles and walked out of Rikers`);
    return freed;
  }

  const attempt = player.jail_turns + 1;
  if (attempt < MAX_JAIL_ATTEMPTS) {
    const stays = await q.updatePlayer(t.db, player.id, { jail_turns: attempt });
    await t.log('jail_stay', stays, { attempt }, `${stays.username} stays in Rikers (attempt ${attempt} of ${MAX_JAIL_ATTEMPTS})`);
    return null;
  }

  // Third failure: pay the fine (or owe it) and move anyway.
  const freed = await q.updatePlayer(t.db, player.id, { is_in_jail: false, jail_turns: 0 });
  await t.charge(freed, JAIL_FINE, null, 'the Rikers fine', {
    type: 'jail_release',
    data: { method: 'forced_fine', amount: JAIL_FINE },
    text: `${freed.username} paid the $${JAIL_FINE} fine after three tries and left Rikers`
  });
  return q.getPlayerById(t.db, player.id);
}

module.exports = { payFine, useCard, rollFromJail };
