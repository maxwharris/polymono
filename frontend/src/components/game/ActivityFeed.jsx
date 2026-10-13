import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { playerColor } from '../../lib/colors';
import { relativeTime } from '../../lib/format';
import { eventIcon, groupByTurn, involvesUser } from '../../lib/events';
import { tokenEmoji } from '../../lib/tokens';
import useNow from '../../hooks/useNow';

const PAGE = 25;

/**
 * The game log from the server, newest turn first: "Jack's turn · 2h ago" then what happened in it.
 * Lines that involve me are highlighted; lines after my last visit carry a "new" mark.
 */
export default function ActivityFeed() {
  const { events, eventsLoaded, seenMarkerId, hasOlderEvents, players, myUserId, loadOlderEvents } = useGameStore(useShallow(s => ({
    events: s.events,
    eventsLoaded: s.eventsLoaded,
    seenMarkerId: s.seenMarkerId,
    hasOlderEvents: s.hasOlderEvents,
    players: s.players,
    myUserId: s.isSpectator ? null : s.user?.id,
    loadOlderEvents: s.loadOlderEvents
  })));
  const now = useNow(60000);
  const [shown, setShown] = useState(PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const groups = useMemo(() => groupByTurn(events).reverse(), [events]);
  const visible = groups.slice(0, shown);
  const newCount = useMemo(
    () => (seenMarkerId == null ? 0 : events.filter(e => e.id > seenMarkerId && e.text && e.user_id !== myUserId).length),
    [events, seenMarkerId, myUserId]
  );

  async function showOlder() {
    if (shown < groups.length) {
      setShown(n => n + PAGE);
      return;
    }
    setLoadingOlder(true);
    try {
      await loadOlderEvents();
      setShown(n => n + PAGE);
    } finally {
      setLoadingOlder(false);
    }
  }

  if (!eventsLoaded && !events.length) return <p className="g-empty">Loading the log…</p>;
  if (!groups.length) return <p className="g-empty">Nothing has happened yet.</p>;

  return (
    <div className="feed">
      {newCount > 0 && <p className="feed-new-count"><span aria-hidden="true">● </span>{newCount} new since your last visit</p>}
      <ol className="feed-groups">
        {visible.map((group, index) => {
          const actor = group.turn ? players.find(p => p.user_id === group.turn.user_id) : null;
          const isNew = seenMarkerId != null && group.lastId > seenMarkerId;
          const nextIsOld = seenMarkerId != null && isNew && visible[index + 1] && visible[index + 1].lastId <= seenMarkerId;
          return (
            <li key={group.key} className="feed-group">
              <h3 className="feed-head" style={{ '--pc': actor ? playerColor(actor) : 'var(--text-muted)' }}>
                {group.turn ? (
                  <>
                    <span className="feed-dot" aria-hidden="true" />
                    <span aria-hidden="true">{actor ? tokenEmoji(actor.token_type) : '▶'}</span>
                    <span>{group.turn.user_id === myUserId ? 'Your turn' : `${group.turn.username}'s turn`}</span>
                  </>
                ) : (
                  <span>Setup</span>
                )}
                <time className="feed-time" dateTime={group.timestamp}>{relativeTime(group.timestamp, now)}</time>
              </h3>
              {group.lines.length > 0 ? (
                <ul className="feed-lines">
                  {group.lines.map(line => {
                    const lineNew = seenMarkerId != null && line.event.id > seenMarkerId && line.event.user_id !== myUserId;
                    const mine = involvesUser(line.event, myUserId);
                    return (
                      <li key={line.id} className={`feed-line${mine ? ' is-mine' : ''}${lineNew ? ' is-new' : ''}`}>
                        <span className="feed-icon" aria-hidden="true">{eventIcon(line.event)}</span>
                        <span className="feed-text">{line.text}</span>
                        {lineNew && <span className="sr-only"> (new)</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="feed-quiet">Nothing yet.</p>
              )}
              {nextIsOld && <p className="feed-divider"><span>Seen before</span></p>}
            </li>
          );
        })}
      </ol>
      {(shown < groups.length || hasOlderEvents) && (
        <button type="button" className="g-btn g-btn--ghost feed-more" onClick={showOlder} disabled={loadingOlder}>
          {loadingOlder ? 'Loading…' : 'Show earlier turns'}
        </button>
      )}
    </div>
  );
}
