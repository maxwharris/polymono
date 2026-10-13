// Handles the animated scene objects register so the director can drive them without React re-renders.
//   tokens: playerId -> { object (THREE.Group), walk(path, options) => Promise, finish() }
//   dice:   { roll(die1, die2, fromIndex) => Promise, finish() } | null
export const tokens = new Map();
export const dice = { current: null };

/** Complete every running animation at once (the tab was hidden, or the queue is being skipped). */
export function finishAll() {
  tokens.forEach(t => t.finish());
  dice.current?.finish();
}
