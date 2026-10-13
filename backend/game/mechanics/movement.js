/**
 * Moving tokens. Takes the transaction context `t` (see gameController.js).
 */

const q = require('../../db/queries');
const { BOARD_SIZE, JAIL_POSITION } = require('../board');

// kind: 'roll' | 'card' | 'back'. Negative steps move backwards and never pay the GO salary.
async function moveBy(t, player, steps, kind) {
  const from = player.position;
  const to = (((from + steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const passedGo = steps > 0 && from + steps >= BOARD_SIZE;

  let moved = await q.updatePlayer(t.db, player.id, { position: to });
  await t.log('move', moved, { from, to, steps, passedGo, kind }, `${moved.username} moved to ${t.spaceName(to)}`);

  if (passedGo) {
    const salary = Number(t.game.settings?.go_salary) || 200;
    moved = await q.addMoney(t.db, player.id, salary);
    const how = to === 0 ? 'landing on' : 'passing';
    await t.log('salary', moved, { amount: salary }, `${moved.username} collected $${salary} for ${how} New Year's Eve`);
  }
  return moved;
}

// reason: 'go_to_jail' | 'three_doubles' | 'card'. Going to jail ends any doubles streak.
async function sendToJail(t, player, reason) {
  const from = player.position;
  const jailed = await q.updatePlayer(t.db, player.id, { position: JAIL_POSITION, is_in_jail: true, jail_turns: 0 });
  await t.log('move', jailed, { from, to: JAIL_POSITION, steps: 0, passedGo: false, kind: 'jail' }, null);
  const why = { go_to_jail: 'was arrested by the NYPD', three_doubles: 'rolled three doubles in a row', card: 'drew a jail card' }[reason];
  await t.log('jail', jailed, { reason }, `${jailed.username} ${why} and went to Rikers`);
  t.ts.extraRoll = false;
  t.ts.doubles = 0;
  return jailed;
}

module.exports = { moveBy, sendToJail };
