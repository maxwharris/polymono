// The animation director: turns game events into dice rolls, token walks and money floaters, one at a time.
//
// - Only events newer than the newest one present when the board mounted are played (history never replays).
// - 'roll' and 'move' are animated in order; 'salary' / 'rent' / 'tax' / 'money' / 'debts_paid' and jail fines
//   ('jail_release' with an amount) spawn floaters.
// - While anything plays, gameStore.animating is true (popups wait for it) and boardAnim.busy mirrors it.
// - When the queue is empty, token spots re-sync to players[].position (reconnects, trades, missed events).
//   Snapshots arrive before their events, so that sync waits a moment for events that explain the change.
// - More than MAX_QUEUED animations waiting, or a hidden tab: skip everything and snap to the snapshot.
import useGameStore from '../../store/gameStore';
import useBoardAnim from '../../store/boardAnim';
import { dice, finishAll, tokens } from './registry';
import { walkPath } from './layout';

const MAX_QUEUED = 6;
export const HOP_SECONDS = 0.17; // per space
export const FAST_HOP_SECONDS = 0.09; // long card moves
export const JUMP_SECONDS = 0.9; // the arc into Rikers
export const ROLL_SECONDS = 1.1;
const AFTER_ROLL_MS = 300;
const SETTLE_MS = 350; // after the last step, before popups may show
const SYNC_GRACE_MS = 1500; // a snapshot with no events yet: wait this long before gliding tokens to it
const SLACK_MS = 1500; // a step never blocks the queue for longer than its duration plus this

const ANIMATED = new Set(['roll', 'move']);
const MONEY = new Set(['salary', 'rent', 'tax', 'fine', 'money', 'jail_release', 'debts_paid']);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const within = (promise, ms) => Promise.race([promise ?? Promise.resolve(), wait(ms)]);
const lastId = events => (events?.length ? events[events.length - 1].id : 0);
const moveTarget = d => (Number.isInteger(d?.to) ? d.to : walkPath(d || {}).at(-1));

function findLast(list, test) {
  for (let i = (list?.length ?? 0) - 1; i >= 0; i--) if (test(list[i])) return list[i];
  return null;
}

/** Every token already stands where the snapshot puts it. */
function standsOn(shown, players) {
  return (players || []).every(p => p.is_bankrupt || shown[p.id] === p.position);
}

/** Starts the director. Returns stop(). `invalidate` requests a frame (frameloop="demand"). */
export function startDirector({ invalidate }) {
  const game = useGameStore;
  const anim = useBoardAnim;
  let cursor = null; // newest event id already handled
  const queue = [];
  let running = false;
  let stopped = false;
  let syncTimer = null;

  function setBusy(busy) {
    anim.setState({ busy });
    game.getState().setAnimating?.(busy);
  }

  // Baseline: everything already in the log counts as seen. Waits for the log if it is still loading.
  function begin(state) {
    if (cursor != null || state.eventsLoaded === false) return;
    cursor = lastId(state.events);
    anim.getState().reset(); // no dice or highlight left over from another game or login
    anim.getState().syncPlayers(state.players, { snap: true });
    const roll = findLast(state.events, e => e.type === 'roll');
    const last = roll?.data ?? state.game?.turn_state?.lastRoll;
    if (last?.die1) anim.getState().showDice(last.die1, last.die2, roll?.player_id ?? null, false);
    invalidate();
  }

  function receive(events) {
    const newest = lastId(events);
    if (newest < cursor) {
      cursor = newest; // the log was reset (new game): nothing to replay
      queue.length = 0;
      anim.getState().reset();
      return;
    }
    let i = events.length;
    while (i > 0 && events[i - 1].id > cursor) i--;
    if (i === events.length) return;
    cursor = newest;
    for (const e of events.slice(i)) {
      if (e.type === 'reset') {
        queue.length = 0; // a new game: drop what is left of the old one, and its dice
        anim.getState().reset();
      } else if (ANIMATED.has(e.type) || MONEY.has(e.type)) queue.push(e);
    }
    if (queue.length) run();
  }

  function skip() {
    const roll = findLast(queue, e => e.type === 'roll' && e.data?.die1);
    queue.length = 0;
    finishAll();
    if (roll) anim.getState().showDice(roll.data.die1, roll.data.die2, roll.player_id, false);
    anim.getState().syncPlayers(game.getState().players, { snap: true });
    invalidate();
  }

  async function run() {
    if (running || stopped) return;
    running = true;
    clearTimeout(syncTimer);
    setBusy(true);
    while (!stopped) {
      while (queue.length && !stopped) {
        const waiting = queue.reduce((n, e) => n + (ANIMATED.has(e.type) ? 1 : 0), 0);
        if (document.hidden || waiting > MAX_QUEUED) {
          skip();
          break;
        }
        try {
          await perform(queue.shift());
        } catch (err) {
          console.error('board animation failed', err);
        }
      }
      await wait(SETTLE_MS);
      if (!queue.length || stopped) break;
    }
    running = false;
    if (stopped) return;
    anim.setState({ walking: null });
    // Normally the tokens already stand where the snapshot says. If not, the snapshot is ahead of events that
    // are still on the way: give them the same grace as any other snapshot instead of gliding there now.
    const { players } = game.getState();
    if (standsOn(anim.getState().shown, players)) anim.getState().syncPlayers(players);
    else scheduleSync();
    setBusy(false);
    invalidate();
  }

  async function perform(e) {
    const a = anim.getState();
    const d = e.data || {};

    if (e.type === 'roll') {
      if (!d.die1 || !d.die2) return;
      a.showDice(d.die1, d.die2, e.player_id, true);
      invalidate();
      await within(dice.current?.roll(d.die1, d.die2, a.shown[e.player_id]), ROLL_SECONDS * 1000 + SLACK_MS);
      await wait(AFTER_ROLL_MS);
      return;
    }

    if (e.type === 'move') {
      const path = walkPath(d);
      const to = moveTarget(d);
      if (!Number.isInteger(to)) return;
      const jump = d.kind === 'jail';
      // A snapshot sync ran ahead of these events (slow log after a wake, slow socket): the token already
      // stands where this player's queued moves end, not where this one starts. Don't walk it back to replay them.
      const last = findLast(queue, q => q.type === 'move' && q.player_id === e.player_id);
      const at = a.shown[e.player_id];
      if (at !== d.from && at === (last ? moveTarget(last.data) : to)) return;
      a.place(e.player_id, to, jump);
      const token = tokens.get(e.player_id);
      if (!token || !path.length) return;
      const hop = jump ? JUMP_SECONDS : path.length > 12 ? FAST_HOP_SECONDS : HOP_SECONDS;
      anim.setState({ walking: e.player_id });
      invalidate();
      await within(token.walk(path, { hop, jump }), hop * path.length * 1000 + SLACK_MS);
      anim.setState({ walking: null });
      anim.getState().land(to, e.player_id);
      invalidate();
      return;
    }

    // Money floaters: payer above their token, salary at New Year's Eve, income above whoever receives it.
    const amount = Math.round(Number(d.amount));
    if (!Number.isFinite(amount) || amount === 0) return; // also a jail_release that cost nothing
    const at = a.shown[e.player_id];
    if (e.type === 'salary') a.addFloater(0, Math.abs(amount), 'salary');
    else if (e.type === 'rent') {
      if (at != null) a.addFloater(at, -Math.abs(amount), 'rent');
      const ownerAt = a.shown[d.ownerId];
      if (ownerAt != null && ownerAt !== at) a.addFloater(ownerAt, Math.abs(amount), 'rent');
    } else if (e.type === 'debts_paid') {
      if (at != null) a.addFloater(at, -Math.abs(amount), 'debt');
      const paid = new Map(); // creditor player id -> total (the bank has no token)
      for (const p of d.payments || []) {
        if (p?.creditorId != null) paid.set(p.creditorId, (paid.get(p.creditorId) ?? 0) + (Math.round(Number(p.amount)) || 0));
      }
      paid.forEach((sum, creditorId) => {
        const creditorAt = a.shown[creditorId];
        if (creditorAt != null && creditorAt !== at && sum > 0) a.addFloater(creditorAt, sum, 'debt');
      });
    } else if (at != null) {
      const label = e.type === 'tax' ? 'tax' : e.type === 'fine' || e.type === 'jail_release' ? 'fine' : '';
      a.addFloater(at, e.type === 'money' ? amount : -Math.abs(amount), label);
    }
    invalidate();
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (running || stopped) return;
      anim.getState().syncPlayers(game.getState().players);
      invalidate();
    }, SYNC_GRACE_MS);
  }

  function onVisibility() {
    if (document.hidden && running) finishAll(); // the loop sees document.hidden and snaps the rest
  }

  const unsubscribe = game.subscribe((state, prev) => {
    if (state.eventsLoaded === false && cursor != null && !running) cursor = null; // logged out: re-baseline
    if (cursor == null) begin(state);
    else if (state.events !== prev.events) receive(state.events || []);
    if (state.players !== prev.players && !running) scheduleSync();
  });
  document.addEventListener('visibilitychange', onVisibility);
  begin(game.getState());

  return function stop() {
    stopped = true;
    unsubscribe();
    clearTimeout(syncTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    queue.length = 0;
    finishAll();
    anim.getState().reset(); // the next board starts clean (begin() puts the last roll back)
    if (running) {
      running = false;
      anim.setState({ busy: false });
      game.getState().setAnimating?.(false);
    }
  };
}
