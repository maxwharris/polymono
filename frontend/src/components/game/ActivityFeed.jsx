import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectFeedCutoff } from '../../store/gameStore';
import { relativeTime } from '../../lib/format';
import { eventIcon, groupByTurn, involvesUser } from '../../lib/events';
import useNow from '../../hooks/useNow';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { MoneyText } from './bits';

const PAGE = 25;

/** One feed line: a drawn icon, then the sentence with its amounts set as money. */
export function FeedLine({ line, mine = false, isNew = false }) {
  return (
    <li className={`feed__line${mine ? ' is-mine' : ''}${isNew ? ' is-new' : ''}`}>
      <Icon name={eventIcon(line.event)} size={18} className="feed__icon" />
      <span className="feed__text">
        <MoneyText text={line.text} />
        {isNew && <span className="sr-only"> (new)</span>}
      </span>
    </li>
  );
}

/**
 * The game log from the server, newest turn first: "jack's turn" with the time, then what happened in it,
 * with my own actions as "You …".
 * Lines that involve me get a brass rule and wash; lines since my last visit are marble with a brass dot.
 * While the board is still rolling or walking, lines newer than what it has shown are held back.
 */
export default function ActivityFeed() {
  const { events, eventsLoaded, seenMarkerId, hasOlderEvents, players, properties, myUserId, loadOlderEvents, cutoff } = useGameStore(useShallow(s => ({
    events: s.events,
    eventsLoaded: s.eventsLoaded,
    seenMarkerId: s.seenMarkerId,
    hasOlderEvents: s.hasOlderEvents,
    players: s.players,
    properties: s.properties,
    myUserId: s.isSpectator ? null : s.user?.id,
    loadOlderEvents: s.loadOlderEvents,
    cutoff: selectFeedCutoff(s)
  })));
  const now = useNow(60000);
  const [shown, setShown] = useState(PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const shownEvents = useMemo(() => (cutoff == null ? events : events.filter(e => e.id <= cutoff)), [events, cutoff]);
  // Lines that involve me read "You bought …", "seabass paid you $25 rent …" (lib/events.js eventText).
  const groups = useMemo(
    () => groupByTurn(shownEvents, { myUserId, players, properties }).reverse(),
    [shownEvents, myUserId, players, properties]
  );
  const visible = groups.slice(0, shown);
  const newCount = useMemo(
    () => (seenMarkerId == null ? 0 : shownEvents.filter(e => e.id > seenMarkerId && e.text && e.user_id !== myUserId).length),
    [shownEvents, seenMarkerId, myUserId]
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

  if (!eventsLoaded && !events.length) return <p className="feed__empty">Loading the log…</p>;
  if (!groups.length) return <p className="feed__empty">Nothing has happened yet.</p>;

  return (
    <div className="feed">
      {newCount > 0 && (
        <p className="ui-well ui-well--brass feed__new">
          <span className="feed__new-dot" aria-hidden="true" />
          {newCount} new since you last looked
        </p>
      )}
      <ol className="feed__groups">
        {visible.map((group, index) => {
          const actor = group.turn ? players.find(p => p.user_id === group.turn.user_id) : null;
          const isNew = seenMarkerId != null && group.lastId > seenMarkerId;
          const nextIsOld = seenMarkerId != null && isNew && visible[index + 1] && visible[index + 1].lastId <= seenMarkerId;
          return (
            <li key={group.key} className="feed__group">
              <h3 className="feed__head">
                {actor ? <Medallion player={actor} size={22} /> : <span className="feed__head-icon"><Icon name="players" size={16} /></span>}
                <span className="feed__who">
                  {group.turn ? (group.turn.user_id === myUserId ? 'Your turn' : `${group.turn.username}'s turn`) : 'Setting up'}
                </span>
                <time className="feed__time" dateTime={group.timestamp}>{relativeTime(group.timestamp, now)}</time>
              </h3>
              {group.lines.length > 0 ? (
                <ul className="feed__lines">
                  {group.lines.map(line => (
                    <FeedLine
                      key={line.id}
                      line={line}
                      mine={involvesUser(line.event, myUserId)}
                      isNew={seenMarkerId != null && line.event.id > seenMarkerId && line.event.user_id !== myUserId}
                    />
                  ))}
                </ul>
              ) : (
                <p className="feed__quiet">Nothing yet.</p>
              )}
              {nextIsOld && <p className="ui-divider ui-divider--label feed__seen">Seen before</p>}
            </li>
          );
        })}
      </ol>
      {(shown < groups.length || hasOlderEvents) && (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--block feed__more" onClick={showOlder} disabled={loadingOlder} aria-busy={loadingOlder || undefined}>
          {loadingOlder ? 'Loading…' : 'Show earlier turns'}
        </button>
      )}
    </div>
  );
}
