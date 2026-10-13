import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { tokenEmoji, tokenLabel } from '../lib/tokens';
import { playerColor } from '../lib/colors';
import { money } from '../lib/format';
import ConfirmStep from './screens/ConfirmStep';
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

function turnTimerText(settings) {
  const hours = Number(settings?.turn_hours);
  if (!Number.isFinite(hours)) return null;
  if (hours === 0) return 'No turn timer';
  return `${hours} hour${hours === 1 ? '' : 's'} per turn`;
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
  const allReady = count > 0 && notReady.length === 0;
  const canStart = iAmHost && count >= 2 && count <= MAX_PLAYERS && allReady;
  const full = count >= MAX_PLAYERS;

  let startHint = null;
  if (count < 2) {
    startHint = 'At least 2 players are needed to start.';
  } else if (!allReady) {
    const names = notReady.map(p => (p.id === me?.id ? 'you' : p.username));
    startHint = `Waiting for ${listNames(names)} to be ready.`;
  }

  const timer = turnTimerText(game?.settings);
  const startingCash = Number(game?.settings?.starting_money);

  return (
    <main className={`${ui.theme} ${s.page}`}>
      <div className={`${ui.panel} ${s.card}`}>
        <header className={s.header}>
          <img className={s.logo} src="/polymono-logo.webp" alt="" width="96" height="52" decoding="async" />
          <div className={s.heading}>
            <h1 className={s.title}>Game lobby</h1>
            <p className={s.subtitle}>Polymono · Manhattan Edition</p>
          </div>
          <button type="button" className={`${ui.btn} ${ui.ghost} ${ui.small}`} onClick={() => logout()}>
            Log out
          </button>
        </header>

        <ul className={s.settings} aria-label="Game settings">
          {timer && <li>{timer}</li>}
          {Number.isFinite(startingCash) && startingCash > 0 && <li>{money(startingCash)} starting cash</li>}
          <li>2–{MAX_PLAYERS} players</li>
        </ul>

        {status && status !== 'lobby' && (
          <p className={ui.notice}>
            {status === 'in_progress' ? 'The game has already started.' : 'The last game is over.'}
          </p>
        )}

        <section className={s.section} aria-labelledby="lobby-players">
          <h2 id="lobby-players" className={s.sectionTitle}>
            Players <span className={s.count}>{count} of {MAX_PLAYERS}</span>
          </h2>

          {count === 0 ? (
            <p className={ui.hint}>Nobody has joined yet.</p>
          ) : (
            <ul className={s.players}>
              {seated.map(player => {
                const isMe = player.id === me?.id;
                const isHost = player.id === host?.id;
                const isOnline = online.has(player.user_id);
                const color = playerColor(player);
                return (
                  <li key={player.id} className={`${s.player} ${isMe ? s.playerMe : ''}`} style={{ '--player': color }}>
                    <span className={s.token} aria-hidden="true">{tokenEmoji(player.token_type)}</span>
                    <div className={s.playerInfo}>
                      <p className={s.playerName}>
                        <span className={s.name}>{player.username}</span>
                        {isMe && <span className={s.you}>(you)</span>}
                        {isHost && <span className={`${ui.badge} ${ui.badgeGold}`}>Host</span>}
                      </p>
                      <p className={s.playerMeta}>
                        <span className={`${s.dot} ${isOnline ? s.dotOnline : ''}`} aria-hidden="true" />
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tokenLabel(player.token_type)}</span>
                      </p>
                    </div>
                    <span className={`${s.ready} ${player.ready_to_start ? s.readyYes : ''}`}>
                      {player.ready_to_start ? '✓ Ready' : 'Not ready'}
                    </span>
                    {iAmHost && !isMe && confirmRemoveId !== player.id && (
                      <button
                        type="button"
                        className={`${ui.btn} ${ui.dangerOutline} ${ui.small} ${s.remove}`}
                        onClick={() => setConfirmRemoveId(player.id)}
                        disabled={!!pending}
                        aria-label={`Remove ${player.username}`}
                      >
                        Remove
                      </button>
                    )}
                    {confirmRemoveId === player.id && (
                      <div className={s.confirmRow}>
                        <ConfirmStep
                          message={`Remove ${player.username} from the lobby?`}
                          detail="They can join again from their own screen."
                          confirmLabel="Remove"
                          busy={pending === 'remove'}
                          busyLabel="Removing…"
                          onConfirm={() => removePlayer(player.id)}
                          onCancel={() => setConfirmRemoveId(null)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={s.actions} aria-label="Your options">
          {watching ? (
            <p className={ui.notice}>You are watching as a spectator. The game appears here once the host starts it.</p>
          ) : inLobby ? (
            <>
              <button
                type="button"
                className={`${ui.btn} ${me.ready_to_start ? ui.outline : ui.primary} ${ui.block}`}
                aria-pressed={!!me.ready_to_start}
                onClick={() => run('ready', 'ready')}
                disabled={!!pending || status !== 'lobby'}
              >
                {pending === 'ready' ? 'Saving…' : me.ready_to_start ? "✓ I'm ready (tap to undo)" : "I'm ready"}
              </button>

              {iAmHost ? (
                <div className={s.startBlock}>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.primary} ${ui.block}`}
                    onClick={() => run('start', 'start')}
                    disabled={!canStart || !!pending}
                    aria-describedby={startHint ? 'lobby-start-hint' : undefined}
                  >
                    {pending === 'start' ? 'Starting…' : 'Start the game'}
                  </button>
                  {startHint && <p id="lobby-start-hint" className={ui.hint}>{startHint}</p>}
                </div>
              ) : (
                <p className={s.waiting}>
                  Waiting for {host ? <strong>{host.username}</strong> : 'the host'} to start the game.
                  {startHint && <span className={s.waitingDetail}> {startHint}</span>}
                </p>
              )}

              <button
                type="button"
                className={`${ui.btn} ${ui.ghost} ${s.leave}`}
                onClick={() => run('leave', 'leave')}
                disabled={!!pending}
              >
                {pending === 'leave' ? 'Leaving…' : 'Leave lobby'}
              </button>
            </>
          ) : (
            <>
              <p className={ui.notice}>
                {pending === 'join'
                  ? 'Taking a seat…'
                  : full
                    ? 'The lobby is full.'
                    : "You don't have a seat in this game."}
              </p>
              <button
                type="button"
                className={`${ui.btn} ${ui.primary} ${ui.block}`}
                onClick={() => run('join', 'join')}
                disabled={!!pending || full || status !== 'lobby'}
              >
                {pending === 'join' ? 'Joining…' : 'Join the game'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
