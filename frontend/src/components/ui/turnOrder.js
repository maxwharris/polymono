// Turn-order helpers shared by the turn dial, the top bar and the waiting panel ("You're up after raymond").

/** Players in seat order (by turn_order), without mutating the input. */
export function seatOrder(players = []) {
  return [...players].sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0));
}

/** Players still in the game, in seat order. */
function active(players) {
  return seatOrder(players).filter(p => !p.is_bankrupt);
}

/**
 * How many turns until mine: 0 when it is my turn, 1 when I am next, null when I am not playing (spectator,
 * bankrupt) or nobody is up.
 */
export function turnsUntilMine(players, currentUserId, myUserId) {
  const order = active(players);
  const cur = order.findIndex(p => p.user_id === currentUserId);
  const mine = order.findIndex(p => p.user_id === myUserId);
  if (cur < 0 || mine < 0) return null;
  return (mine - cur + order.length) % order.length;
}

/** "You're up next" / "You're up after raymond", or null when it is your turn or you are not playing. */
export function upNextLine(players, currentUserId, myUserId) {
  const n = turnsUntilMine(players, currentUserId, myUserId);
  if (n === null || n === 0) return null;
  if (n === 1) return "You're up next";
  const order = active(players);
  const mine = order.findIndex(p => p.user_id === myUserId);
  const before = order[(mine - 1 + order.length) % order.length];
  return `You're up after ${before.username}`;
}

/** "Your turn" / "jack's turn" / null when nobody is up. */
export function turnName(players, currentUserId, myUserId) {
  if (currentUserId == null) return null;
  if (currentUserId === myUserId) return 'Your turn';
  const current = players.find(p => p.user_id === currentUserId);
  return current ? `${current.username}'s turn` : null;
}
