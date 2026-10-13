/**
 * Turn order, turn phases and the end of the game. Every function takes the transaction context `t`
 * (see gameController.js) and mutates t.ts, the turn state persisted in game.turn_state.
 */

const q = require('../../db/queries');

function freshTurnState() {
  return {
    phase: 'roll',            // roll | buy | debt | end
    rolled: false,
    doubles: 0,
    lastRoll: null,
    extraRoll: false,         // rolled doubles and may roll again
    pendingPropertyId: null,  // unowned property waiting for buy/decline
    debts: []                 // [{ creditorId (player id) | null for the bank, amount, reason }]
  };
}

function normalizeTurnState(ts) {
  return { ...freshTurnState(), ...(ts || {}), debts: Array.isArray(ts?.debts) ? ts.debts : [] };
}

// Works out what the current player must do next from the turn state.
function settle(ts) {
  if (ts.debts.length) ts.phase = 'debt';
  else if (ts.pendingPropertyId) ts.phase = 'buy';
  else if (!ts.rolled || ts.extraRoll) ts.phase = 'roll';
  else ts.phase = 'end';
  return ts.phase;
}

async function startTurn(t, player) {
  const hours = Number(t.game.settings?.turn_hours) || 0;
  const deadline = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000) : null;
  t.game = await q.updateGame(t.db, { current_turn_user_id: player.user_id, turn_deadline: deadline });
  t.ts = freshTurnState();
  const where = player.is_in_jail ? ' (in Rikers)' : '';
  await t.log('turn', player, { deadline }, `It's ${player.username}'s turn${where}`);
}

// Hands the turn to the next player in seat order who is still in the game.
async function advanceTurn(t) {
  const players = await q.getAllPlayers(t.db);
  const seat = players.findIndex(p => p.user_id === t.game.current_turn_user_id);
  for (let i = 1; i <= players.length; i++) {
    const next = players[(seat + i + players.length) % players.length];
    if (!next.is_bankrupt) {
      return startTurn(t, next);
    }
  }
}

async function endGame(t, winner) {
  t.game = await q.updateGame(t.db, {
    status: 'completed',
    completed_at: new Date(),
    current_turn_user_id: null,
    turn_deadline: null,
    winner_user_id: winner ? winner.user_id : null
  });
  t.ts = { ...freshTurnState(), phase: 'over' };
  await t.log('game_over', winner, { winnerUserId: winner?.user_id ?? null },
    winner ? `${winner.username} wins the game!` : 'Game over');
}

module.exports = { freshTurnState, normalizeTurnState, settle, startTurn, advanceTurn, endGame };
