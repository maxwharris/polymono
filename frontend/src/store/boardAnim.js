/**
 * What the 3D board is showing right now, as opposed to what the server says (gameStore).
 *
 * The server sends game:state before game:events, so players[].position is already the destination when
 * the dice start to roll. Tokens therefore render from `shown`, which the animation director
 * (components/board/director.js) advances one event at a time and re-syncs to players[] when it is idle.
 */
import { create } from 'zustand';

const FOLLOW_KEY = 'polymono:boardFollow';

function readFollow() {
  try {
    return localStorage.getItem(FOLLOW_KEY) !== '0';
  } catch {
    return true;
  }
}

let floaterSeq = 0;

const useBoardAnim = create((set, get) => ({
  shown: {}, // playerId -> board index the token stands on
  jailed: {}, // playerId -> true when shown inside the Rikers cell (not just visiting)
  snapNonce: 0, // bumps when tokens must jump to their spots instead of gliding
  busy: false, // the director is playing animations (mirrored into gameStore.animating)

  dice: null, // { die1, die2, playerId, nonce }: the last roll, shown at rest on the board
  walking: null, // playerId whose token is walking (the camera follows it)
  landing: null, // { position, playerId, nonce }: highlight under the space just landed on
  floaters: [], // { id, position, amount, label }: "+$200" style labels over the board
  follow: readFollow(), // camera follows walking tokens
  recenterNonce: 0, // bump to fly the camera back to the overview

  /** Positions from the server snapshot. Players not in the list are dropped. */
  syncPlayers: (players, { snap = false } = {}) => {
    const shown = {};
    const jailed = {};
    for (const p of players || []) {
      if (p.is_bankrupt) continue;
      shown[p.id] = p.position;
      jailed[p.id] = !!p.is_in_jail && p.position === 10;
    }
    const prev = get();
    const same = !snap && sameMap(prev.shown, shown) && sameMap(prev.jailed, jailed);
    if (same) return;
    set({ shown, jailed, ...(snap ? { snapNonce: prev.snapNonce + 1 } : null) });
  },

  /** One token moves (the walk animation itself is driven by the token). */
  place: (playerId, position, inJail = false) =>
    set(s => ({ shown: { ...s.shown, [playerId]: position }, jailed: { ...s.jailed, [playerId]: inJail } })),

  showDice: (die1, die2, playerId, animate) =>
    set(s => ({ dice: { die1, die2, playerId, nonce: animate ? (s.dice?.nonce ?? 0) + 1 : (s.dice?.nonce ?? 0) } })),

  land: (position, playerId) => set(s => ({ landing: { position, playerId, nonce: (s.landing?.nonce ?? 0) + 1 } })),

  addFloater: (position, amount, label) => {
    const id = ++floaterSeq;
    set(s => ({ floaters: [...s.floaters, { id, position, amount, label }].slice(-8) }));
    setTimeout(() => set(s => ({ floaters: s.floaters.filter(f => f.id !== id) })), 2200);
  },

  setFollow: (follow) => {
    try {
      localStorage.setItem(FOLLOW_KEY, follow ? '1' : '0');
    } catch {
      // private mode: the toggle just isn't remembered
    }
    set({ follow: !!follow });
  },

  recenter: () => set(s => ({ recenterNonce: s.recenterNonce + 1 })),

  /** Forget the dice, highlight and floaters of what was shown before (a new board, game or login). */
  reset: () => set({ dice: null, walking: null, landing: null, floaters: [] })
}));

function sameMap(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => a[k] === b[k]);
}

export default useBoardAnim;
