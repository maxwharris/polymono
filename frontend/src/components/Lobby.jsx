import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { tokenLabel } from '../lib/tokens';
import { money } from '../lib/format';
import { api } from '../lib/api';
import Icon from './ui/Icon';
import Medallion from './ui/Medallion';
import Wordmark from './ui/Wordmark';
import ConfirmDialog from './screens/ConfirmDialog';
import PastGames from './screens/PastGames';
import ui from './screens/ui.module.css';
import s from './screens/Lobby.module.css';

const MAX_PLAYERS = 6;

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// The log holds only this lobby's events (a new game wipes it): did this user leave, or get removed, since?
function leftThisLobby(events, userId) {
  if (userId == null) return false;
  return events.some(e => (e.type === 'leave' || e.type === 'removed') && (e.user_id === userId || e.data?.removedUserId === userId));
}

// The settings plaque: three static values ("24h per turn", "$1,500 to start", "2–6 players").
function plaqueCells(settings) {
  const cells = [];
  const hours = Number(settings?.turn_hours);
  if (Number.isFinite(hours)) cells.push(hours === 0 ? { value: 'Off', label: 'turn timer' } : { value: `${hours}h`, label: 'per turn' });
  const cash = Number(settings?.starting_money);
  if (Number.isFinite(cash) && cash > 0) cells.push({ value: money(cash), label: 'to start' });
  cells.push({ value: `2–${MAX_PLAYERS}`, label: 'players' });
  return cells;
}

export default function Lobby() {
  const { user, isSpectator, game, players, presence, eventsLoaded, leftBefore, act, logout } = useGameStore(useShallow(state => ({
    user: state.user,
    isSpectator: state.isSpectator,
    game: state.game,
    players: state.players,
    presence: state.presence,
    eventsLoaded: state.eventsLoaded,
    leftBefore: leftThisLobby(state.events, state.user?.id),
    act: state.act,
    logout: state.logout
  })));

  const [pending, setPending] = useState(null); // 'join' | 'ready' | 'start' | 'leave' | 'remove'
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [history, setHistory] = useState(null); // finished games, newest first
  const autoJoinTried = useRef(false);

  const seated = [...(players || [])].sort((a, b) => a.turn_order - b.turn_order);
  const me = seated.find(p => p.user_id === user?.id) || null;
  const host = seated[0] || null;
  const iAmHost = !!me && host?.id === me.id;
  const status = game?.status;
  const watching = isSpectator || !!user?.isSpectator;
  const inLobby = !!me;
  const online = new Set(presence || []);

  // Join once when the lobby first loads. A player the host removed (or who left) gets a button to come
  // back instead of being re-joined automatically, also after a reload: the log says they left, so wait
  // for it.
  useEffect(() => {
    if (autoJoinTried.current || watching || !user || status === undefined || !eventsLoaded) return;
    autoJoinTried.current = true;
    if (status !== 'lobby' || inLobby || leftBefore) return;
    Promise.resolve()
      .then(() => {
        setPending('join');
        return act('join');
      })
      .catch(() => {}) // act() already showed the error
      .finally(() => setPending(current => (current === 'join' ? null : current)));
  }, [status, inLobby, watching, user, eventsLoaded, leftBefore, act]);

  // Fetch the board art and everyone's token models while people wait, so the game opens instantly.
  // A dynamic import keeps three.js out of the login/lobby bundle.
  const tokenTypes = seated.map(p => p.token_type).join(',');
  useEffect(() => {
    if (!tokenTypes) return;
    import('./board/assets').then(m => m.preloadBoard(tokenTypes.split(','))).catch(() => {});
  }, [tokenTypes]);

  // Past games, for the record. Read once per visit; nothing here depends on it.
  useEffect(() => {
    let live = true;
    api('/game/history')
      .then(data => { if (live) setHistory(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, []);

  async function run(kind, route, body) {
    if (pending) return;
    setPending(kind);
    try {
      await act(route, body);
      return true;
    } catch {
      return false; // act() already showed the error
    } finally {
      setPending(null);
    }
  }

  async function removePlayer(playerId) {
    const ok = await run('remove', 'remove-player', { playerId });
    if (ok) setConfirmRemoveId(null);
  }

  const count = seated.length;
  const notReady = seated.filter(p => !p.ready_to_start);
  const readyCount = count - notReady.length;
  const allReady = count > 0 && notReady.length === 0;
  const canStart = iAmHost && count >= 2 && count <= MAX_PLAYERS && allReady;
  const full = count >= MAX_PLAYERS;
  const hostName = host ? (host.id === me?.id ? 'you' : host.username) : 'the host';

  let startHint = null;
  if (count < 2) {
    startHint = 'At least 2 players are needed to start.';
  } else if (!allReady) {
    const names = notReady.map(p => (p.id === me?.id ? 'you' : p.username));
    startHint = `Waiting for ${listNames(names)} to be ready.`;
  }

  let readyLine = 'Nobody has joined yet';
  if (count > 0) {
    readyLine = allReady
      ? (count === 1 ? 'The one player here is ready' : `All ${count} players are ready`)
      : `${readyCount} of ${count} player${count === 1 ? '' : 's'} ${readyCount === 1 ? 'is' : 'are'} ready`;
  }

  // The line that speaks to whoever is looking.
  let viewerLine;
  if (watching) viewerLine = `You're watching as a spectator. The game appears here once ${host ? host.username : 'the host'} starts it.`;
  else if (iAmHost) viewerLine = "You're the host. Start the game once everyone at the table is ready.";
  else if (inLobby) viewerLine = `${host.username} is the host and starts the game once everyone is ready.`;
  else if (pending === 'join') viewerLine = 'Taking a seat…';
  else if (full) viewerLine = 'The table is full.';
  else viewerLine = "You don't have a seat in this game yet.";

  const removing = seated.find(p => p.id === confirmRemoveId) || null;

  return (
    <main className={`${ui.theme} ${s.page}`}>
      <header className={s.header}>
        <Wordmark size="sm" />
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => logout()}>
          <Icon name="logout" size={18} />
          Log out
        </button>
      </header>

      <div className={s.layout}>
        <div className={s.main}>
          <section aria-labelledby="lobby-title">
            <h1 id="lobby-title" className={`ui-display-l ${s.title}`}>Game lobby</h1>
            <p className={s.status}>{readyLine}</p>
            <p className={s.viewer}>{viewerLine}</p>
          </section>

          <dl className={s.plaque} aria-label="Game settings">
            {plaqueCells(game?.settings).map(cell => (
              <div key={cell.label} className={s.plaqueCell}>
                <dt className={s.plaqueValue}>{cell.value}</dt>
                <dd className={s.plaqueLabel}>{cell.label}</dd>
              </div>
            ))}
          </dl>

          {status && status !== 'lobby' && (
            <p className={`${ui.notice} ${s.notice}`}>
              <Icon name="info" size={18} />
              {status === 'in_progress' ? 'The game has already started.' : 'The last game is over.'}
            </p>
          )}

          <section className={s.players} aria-labelledby="lobby-players">
            <h2 id="lobby-players" className={s.paneTitle}>
              Players <span className={s.count}>{count} of {MAX_PLAYERS}</span>
            </h2>

            {count === 0 ? (
              <p className={s.nobody}>Nobody has joined yet.</p>
            ) : (
              <ul className={s.list}>
                {seated.map(player => {
                  const isMe = player.id === me?.id;
                  const isHost = player.id === host?.id;
                  const isOnline = online.has(player.user_id);
                  return (
                    <li key={player.id} className={s.row}>
                      <Medallion player={player} size={42} online={isOnline} />
                      <div className={s.who}>
                        <p className={s.name}>
                          <span className={s.nameText}>{player.username}</span>
                          {isMe && <span className="ui-tag">you</span>}
                          {isHost && (
                            <span className={s.host}>
                              <Icon name="crown" size={14} />
                              Host
                            </span>
                          )}
                        </p>
                        <p className={s.sub}>
                          {tokenLabel(player.token_type)}, {isOnline ? 'online' : 'offline'}
                        </p>
                      </div>
                      {player.ready_to_start ? (
                        <span className={`${s.ready} ${s.readyYes}`}>
                          <Icon name="check" size={16} strokeWidth={2.25} />
                          Ready
                        </span>
                      ) : (
                        <span className={s.ready}>Not ready</span>
                      )}
                      {iAmHost && isMe && <span className={s.removeSpace} aria-hidden="true" />}
                      {iAmHost && !isMe && (
                        <button
                          type="button"
                          className={`ui-btn ui-btn--ghost ui-btn--icon ${s.remove}`}
                          onClick={() => setConfirmRemoveId(player.id)}
                          disabled={!!pending}
                          aria-label={`Remove ${player.username}`}
                          title={`Remove ${player.username}`}
                        >
                          <Icon name="close" size={18} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <PastGames games={history} players={seated} myUserId={user?.id} className={s.past} />

        {!watching && (
          <footer className={`ui-panel ${s.footer}`} aria-label="Your options">
            {inLobby ? (
              <>
                <div className={s.switchRow}>
                  <span id="lobby-ready-label" className={s.switchLabel}>I'm ready</span>
                  <button
                    type="button"
                    role="switch"
                    className="ui-switch"
                    aria-checked={!!me.ready_to_start}
                    aria-labelledby="lobby-ready-label"
                    aria-busy={pending === 'ready' || undefined}
                    onClick={() => run('ready', 'ready')}
                    disabled={!!pending || status !== 'lobby'}
                  />
                </div>

                {iAmHost ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
                    onClick={() => run('start', 'start')}
                    disabled={!canStart || !!pending}
                    aria-describedby={startHint ? 'lobby-start-hint' : undefined}
                  >
                    {pending === 'start' && <span className="ui-spinner" aria-hidden="true" />}
                    {pending === 'start' ? 'Starting…' : 'Start the game'}
                  </button>
                ) : (
                  <p className={`ui-well ${s.waiting}`}>
                    <Icon name="clock" size={18} />
                    <span>Waiting for <strong>{hostName}</strong> to start the game.</span>
                  </p>
                )}

                <div className={s.footRow}>
                  <p id="lobby-start-hint" className={`ui-hint ${s.hint}`}>{startHint}</p>
                  <button
                    type="button"
                    className={`ui-btn ui-btn--ghost ${s.leave}`}
                    onClick={() => run('leave', 'leave')}
                    disabled={!!pending}
                  >
                    {pending === 'leave' ? 'Leaving…' : 'Leave lobby'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
                  onClick={() => run('join', 'join')}
                  disabled={!!pending || full || status !== 'lobby'}
                  aria-describedby={full ? 'lobby-join-hint' : undefined}
                >
                  {pending === 'join' && <span className="ui-spinner" aria-hidden="true" />}
                  {pending === 'join' ? 'Joining…' : 'Join the game'}
                </button>
                {full && <p id="lobby-join-hint" className={`ui-reason ${s.hint}`}>All {MAX_PLAYERS} seats are taken.</p>}
              </>
            )}
          </footer>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        title={removing ? `Remove ${removing.username}?` : ''}
        body="They leave the table and lose their seat. They can join again from their own screen while the game is still in the lobby."
        confirmLabel="Remove"
        busy={pending === 'remove'}
        busyLabel="Removing…"
        onConfirm={() => removing && removePlayer(removing.id)}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </main>
  );
}
