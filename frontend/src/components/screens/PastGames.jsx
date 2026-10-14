import { useId, useState } from 'react';
import { playerColor } from '../../lib/colors';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { dayLabel, isoString, toDate } from './time';
import s from './PastGames.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOW = 4;

// "Played over 23 days with 6 players", from the saved start and end.
function playedLine(game) {
  const start = toDate(game.started_at);
  const end = toDate(game.completed_at);
  const seats = game.standings?.length || 0;
  const who = seats ? ` with ${seats} player${seats === 1 ? '' : 's'}` : '';
  if (!start || !end) return seats ? `${seats} player${seats === 1 ? '' : 's'}` : '';
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
  return days === 1 ? `Played in a day${who}` : `Played over ${days} days${who}`;
}

/**
 * Finished games from GET /api/game/history (newest first), compact: who won and when, with the standings
 * folded underneath (the newest one open). History rows carry no colours, so a medallion takes the
 * player's colour at this table when they are seated, and a neutral ring otherwise.
 *
 * games      the history array, or null while it loads (nothing is shown then)
 * players    the players seated now (for their colours)
 * myUserId   marks "you" in the standings
 */
export default function PastGames({ games, players = [], myUserId = null, className = '' }) {
  const [showAll, setShowAll] = useState(false);
  const id = useId();
  if (!Array.isArray(games)) return null;

  const seatedByUser = new Map(players.map(p => [p.user_id, p]));
  const colorFor = userId => (seatedByUser.has(userId) ? playerColor(seatedByUser.get(userId)) : 'var(--limestone)');
  const list = showAll ? games : games.slice(0, SHOW);

  return (
    <section className={`${s.past} ${className}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.title}>
        Past games {games.length > 0 && <span className={s.count}>{games.length}</span>}
      </h2>

      {games.length === 0 ? (
        <p className={s.none}>No finished games yet. Each one is listed here with its standings.</p>
      ) : (
        <ol className={s.games}>
          {list.map((game, index) => {
            const standings = Array.isArray(game.standings) ? game.standings : [];
            const winner = standings.find(p => p.userId === game.winner_user_id) || standings[0] || null;
            const when = dayLabel(game.completed_at);
            return (
              <li key={game.id ?? index} className={s.game}>
                <details className={s.details} open={index === 0}>
                  <summary className={s.summary}>
                    <span className={s.crown} aria-hidden="true"><Icon name="crown" size={18} /></span>
                    <span className={s.winner}>
                      {winner ? (
                        <><strong>{winner.userId === myUserId ? 'You' : winner.username}</strong> won</>
                      ) : 'Finished'}
                      <span className={s.played}>{playedLine(game)}</span>
                    </span>
                    {when && <time className={s.when} dateTime={isoString(game.completed_at)}>{when}</time>}
                    <Icon name="chevron" size={18} className={s.chev} />
                  </summary>

                  <ol className={s.standings} aria-label="Standings">
                    {standings.map((p, rank) => (
                      <li key={p.userId ?? rank} className={s.standing}>
                        <span className={s.rank}>{rank + 1}</span>
                        <Medallion token={p.tokenType} color={colorFor(p.userId)} out={!!p.bankrupt} size={28} />
                        <span className={s.name}>
                          {p.username}
                          {p.userId === myUserId && <span className="ui-tag">you</span>}
                        </span>
                        {p.bankrupt ? (
                          <span className={s.out}>Bankrupt</span>
                        ) : (
                          <span className={s.worth}>
                            <span className="sr-only">worth </span>
                            <span className="ui-money">{money(p.netWorth)}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      {games.length > SHOW && (
        <button type="button" className={`ui-btn ui-btn--ghost ${s.more}`} onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
          {showAll ? 'Show fewer' : `Show ${games.length - SHOW} older game${games.length - SHOW === 1 ? '' : 's'}`}
        </button>
      )}
    </section>
  );
}
