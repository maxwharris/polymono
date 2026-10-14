import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import useBoardAnim from '../store/boardAnim';

// A token that never catches up (the board failed and stopped syncing) stops holding the panel after this.
const STALE_MS = 4000;

/**
 * "Don't spoil the roll": the server's snapshot arrives before the board has shown the dice and the walk, so
 * the panel must not announce where a token lands until it has landed. Returns
 *   held     true while my roll is in flight, the board animates, or a token still stands short of where the
 *            snapshot puts it (the snapshot came in, its events not yet)
 *   rolling  my roll request is in flight
 *   moving   the board is animating or catching up
 *   walking  a token is walking right now (otherwise the dice are rolling, or the events are on their way)
 *   mover    the player whose token is moving (the board's view of whose turn it still is), or null
 */
export default function useBoardHold() {
  const { animating, boardMover, rolling, players, version } = useGameStore(useShallow(s => ({
    animating: s.animating,
    boardMover: s.boardMover,
    rolling: s.pendingAction === 'roll',
    players: s.players,
    version: s.game?.version ?? 0
  })));
  const { shown, walking } = useBoardAnim(useShallow(s => ({ shown: s.shown, walking: s.walking })));

  const behind = players.filter(p => !p.is_bankrupt && shown[p.id] !== undefined && shown[p.id] !== p.position);
  const key = behind.length ? `${version}|${behind.map(p => `${p.id}:${p.position}`).join(',')}` : '';
  const [stale, setStale] = useState('');
  useEffect(() => {
    if (!key) return undefined;
    const timer = setTimeout(() => setStale(key), STALE_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const lagging = !!key && stale !== key;
  const moverId = walking ?? (lagging ? behind[0].id : null) ?? (animating ? boardMover : null);
  const mover = moverId != null ? players.find(p => p.id === moverId) ?? null : null;
  return { held: rolling || animating || lagging, rolling, moving: animating || lagging, walking: walking != null, mover };
}
