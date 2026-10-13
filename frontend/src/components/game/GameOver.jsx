import { useEffect, useId, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { playerColor } from '../../lib/colors';
import { money, plural } from '../../lib/format';
import { gameStats } from '../../lib/events';
import { standings } from '../../lib/rules';
import { TokenBadge } from './bits';
import Modal from './Modal';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Results when game.status is 'completed': winner, final standings by net worth, a few stats. */
export default function GameOver({ open, onClose }) {
  const { game, players, properties, events, isSpectator, act, pendingAction, fetchOlderLog } = useGameStore(useShallow(s => ({
    game: s.game,
    players: s.players,
    properties: s.properties,
    events: s.events,
    isSpectator: s.isSpectator,
    act: s.act,
    pendingAction: s.pendingAction,
    fetchOlderLog: s.fetchOlderLog
  })));
  const me = useGameStore(selectMyPlayer);
  const titleId = useId();

  // The stats are about the whole game, but after a reload the store holds only the recent log: fetch the
  // rest once. If that fails, show no stats rather than ones from the last few turns.
  const [older, setOlder] = useState(null);
  useEffect(() => {
    let live = true;
    fetchOlderLog().then(list => { if (live) setOlder(list); }).catch(() => {});
    return () => { live = false; };
  }, [fetchOlderLog]);

  const ranking = useMemo(() => standings(players, properties), [players, properties]);
  const stats = useMemo(() => {
    if (!older) return {};
    const first = events[0]?.id ?? Infinity; // the feed may have loaded some of `older` into the store since
    return gameStats([...older.filter(e => e.id < first), ...events], players);
  }, [older, events, players]);
  const winner = players.find(p => p.user_id === game?.winner_user_id) || null;

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="over">
      <div className="over-hero" style={{ '--pc': winner ? playerColor(winner) : 'var(--gold)' }}>
        <span className="over-trophy" aria-hidden="true">🏆</span>
        {winner && <TokenBadge player={winner} size="lg" />}
        <h2 id={titleId} className="over-title">
          {winner ? (winner.id === me?.id ? 'You win!' : `${winner.username} wins!`) : 'Game over'}
        </h2>
        <p className="g-modal-sub">The last one standing in Manhattan.</p>
      </div>

      <h3 className="g-subtitle">Final standings</h3>
      <ol className="over-list">
        {ranking.map(({ player, worth }, i) => (
          <li key={player.id} className={player.is_bankrupt ? 'is-bankrupt' : undefined} style={{ '--pc': playerColor(player) }}>
            <span className="over-rank" aria-hidden="true">{player.is_bankrupt ? '·' : MEDALS[i] || i + 1}</span>
            <TokenBadge player={player} size="sm" />
            <span className="over-name">{player.username}{player.id === me?.id ? ' (you)' : ''}</span>
            <span className="over-worth">
              {player.is_bankrupt ? 'Bankrupt' : <>worth <strong className="money">{money(worth)}</strong></>}
            </span>
          </li>
        ))}
      </ol>

      {(stats.landlord || stats.biggestRent || stats.topBuyer) && (
        <ul className="over-stats">
          {stats.landlord && <li><span aria-hidden="true">💰</span> Top landlord: <strong>{stats.landlord.name}</strong>, {money(stats.landlord.amount)} in rent</li>}
          {stats.biggestRent && <li><span aria-hidden="true">💸</span> Biggest bill: {stats.biggestRent.payer} paid {stats.biggestRent.owner} <strong className="money">{money(stats.biggestRent.amount)}</strong></li>}
          {stats.topBuyer && <li><span aria-hidden="true">🏠</span> Biggest buyer: <strong>{stats.topBuyer.name}</strong>, {plural(stats.topBuyer.count, 'property', 'properties')}</li>}
        </ul>
      )}

      <div className="g-modal-actions">
        <button type="button" className="g-btn g-btn--ghost" onClick={onClose}>See the final board</button>
        {!isSpectator && me && (
          <button
            type="button"
            className="g-btn g-btn--primary"
            disabled={pendingAction === 'new'}
            onClick={() => act('new').catch(() => {})}
          >
            New game
          </button>
        )}
      </div>
    </Modal>
  );
}
