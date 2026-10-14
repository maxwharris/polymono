import { useEffect, useId, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { api } from '../../lib/api';
import { playerColor } from '../../lib/colors';
import { money, plural } from '../../lib/format';
import { gameStats } from '../../lib/events';
import { gameDay, standings } from '../../lib/rules';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { Spinner } from './bits';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';
import './feed.css';
import './sheets.css';

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Finished games from GET /api/game/history, newest first, without the one just shown. */
function PastGames({ game, players, myUserId }) {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api('/game/history')
      .then(list => { if (live) setHistory(Array.isArray(list) ? list : []); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const startedAt = Date.parse(game?.started_at);
  const past = (history || []).filter(h => Date.parse(h.started_at) !== startedAt).slice(0, 12);
  if (failed || (history && !past.length)) return null;

  const colorOf = (userId) => {
    const player = players.find(p => p.user_id === userId);
    return player ? playerColor(player) : 'var(--slate)';
  };

  return (
    <section className="past" aria-labelledby="past-title">
      <h3 id="past-title" className="over__h">Past games</h3>
      {!history ? (
        <p className="past__loading">Loading…</p>
      ) : (
        <ul className="past__list">
          {past.map(h => {
            const ranked = Array.isArray(h.standings) ? h.standings : [];
            const winner = ranked.find(s => s.userId === h.winner_user_id) || ranked[0];
            const days = gameDay(h.started_at, h.completed_at);
            return (
              <li key={h.id}>
                <details className="past__game">
                  <summary>
                    {winner && <Medallion token={winner.tokenType} color={colorOf(winner.userId)} size={30} />}
                    <span className="past__what">
                      {winner ? `${winner.userId === myUserId ? 'You' : winner.username} won` : 'No winner'}
                      <small>{shortDate(h.completed_at)}{days ? `, ${plural(days, 'day')}` : ''}</small>
                    </span>
                    <Icon name="chevron" size={18} className="past__chev" />
                  </summary>
                  <ol className="past__standings">
                    {ranked.map((s, i) => (
                      <li key={`${s.userId}-${i}`}>
                        <span className="over__rank">{i + 1}</span>
                        <Medallion token={s.tokenType} color={s.bankrupt ? undefined : colorOf(s.userId)} out={!!s.bankrupt} size={24} />
                        <span className="past__name">{s.username}</span>
                        <span className="past__worth">
                          {s.bankrupt ? 'Bankrupt' : <>worth <span className="ui-money">{money(s.netWorth)}</span></>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Results when game.status is 'completed': the winner, final standings by net worth, stats, past games.
 * "See the final board" is the brass button and has focus. "Start a new game" moves the whole table to a new
 * lobby (act('new')), so it is secondary and asks first.
 */
export default function GameOver({ open, onClose }) {
  const { game, players, properties, events, isSpectator, act, pendingAction, fetchOlderLog, myUserId } = useGameStore(useShallow(s => ({
    game: s.game,
    players: s.players,
    properties: s.properties,
    events: s.events,
    isSpectator: s.isSpectator,
    act: s.act,
    pendingAction: s.pendingAction,
    fetchOlderLog: s.fetchOlderLog,
    myUserId: s.isSpectator ? null : s.user?.id
  })));
  const me = useGameStore(selectMyPlayer);
  const titleId = useId();
  const [confirmNew, setConfirmNew] = useState(false);

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
    if (!older) return null;
    const first = events[0]?.id ?? Infinity; // the feed may have loaded some of `older` into the store since
    return gameStats([...older.filter(e => e.id < first), ...events], players);
  }, [older, events, players]);
  const winner = players.find(p => p.user_id === game?.winner_user_id) || null;
  const lastDay = game?.started_at ? gameDay(game.started_at, game.completed_at || Date.parse(game.started_at)) : null;
  const summary = [lastDay && `Day ${lastDay}`, stats?.turns && `after ${plural(stats.turns, 'turn')}`].filter(Boolean).join(', ');

  return (
    <>
      <Modal open={open} onClose={onClose} labelledBy={titleId} variant="sheet" className="over">
        <div className="over__hero">
          <span className="over__crown" aria-hidden="true"><Icon name="crown" size={28} /></span>
          <h2 id={titleId} className="over__title">
            {winner ? (winner.id === me?.id ? 'You win Manhattan' : `${winner.username} wins Manhattan`) : 'Game over'}
          </h2>
          {summary && <p className="over__sub">{summary}</p>}
        </div>

        <h3 className="sr-only">Final standings</h3>
        <ol className="over__list">
          {ranking.map(({ player, worth }, i) => {
            const outDay = player.is_bankrupt && stats?.bankruptAt.get(player.user_id) && game?.started_at
              ? gameDay(game.started_at, stats.bankruptAt.get(player.user_id))
              : null;
            return (
              <li key={player.id} className={player.is_bankrupt ? 'is-out' : undefined}>
                <span className="over__rank">{i + 1}</span>
                <Medallion player={player} size={30} />
                <span className="over__name">
                  {player.username}
                  {player.id === me?.id && <span className="ui-tag">you</span>}
                </span>
                <span className="over__worth">
                  {player.is_bankrupt
                    ? (outDay ? `Bankrupt on day ${outDay}` : 'Bankrupt')
                    : <>worth <span className="ui-money">{money(worth)}</span></>}
                </span>
              </li>
            );
          })}
        </ol>

        {stats && (stats.landlord || stats.biggestRent || stats.topBuyer) && (
          <ul className="feed__lines over__stats" aria-label="Stats">
            {stats.landlord && (
              <li className="feed__line"><Icon name="note" size={18} className="feed__icon" /><span className="feed__text">Top landlord: {stats.landlord.name}, <span className="ui-money">{money(stats.landlord.amount)}</span> in rent</span></li>
            )}
            {stats.biggestRent && (
              <li className="feed__line"><Icon name="note" size={18} className="feed__icon" /><span className="feed__text">Biggest bill: {stats.biggestRent.payer} paid {stats.biggestRent.owner} <span className="ui-money">{money(stats.biggestRent.amount)}</span></span></li>
            )}
            {stats.topBuyer && (
              <li className="feed__line"><Icon name="house" size={18} className="feed__icon" /><span className="feed__text">Biggest buyer: {stats.topBuyer.name}, {plural(stats.topBuyer.count, 'property', 'properties')}</span></li>
            )}
          </ul>
        )}

        <PastGames game={game} players={players} myUserId={myUserId} />

        <div className="ui-sheet__actions">
          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose} data-autofocus>See the final board</button>
          {!isSpectator && me && (
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              disabled={pendingAction === 'new'}
              aria-busy={pendingAction === 'new' || undefined}
              onClick={() => setConfirmNew(true)}
            >
              {pendingAction === 'new' && <Spinner />}
              Start a new game
            </button>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={open && confirmNew}
        title="Start a new game?"
        confirmLabel="Start a new game"
        tone="primary"
        busy={pendingAction === 'new'}
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          act('new').catch(() => {}); // act() already showed the error
        }}
      >
        <p>Everyone goes back to the lobby with their seats, and the board and the log are cleared.</p>
        <p>The result stays under Past games.</p>
      </ConfirmDialog>
    </>
  );
}
