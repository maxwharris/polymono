import { useEffect, useId, useState } from 'react';
import useGameStore from '../store/gameStore';
import { api, getToken } from '../lib/api';
import { TOKEN_TYPES, tokenEmoji, tokenLabel } from '../lib/tokens';
import ConfirmStep from './screens/ConfirmStep';
import { dayLabel } from './screens/time';
import ui from './screens/ui.module.css';
import s from './screens/Admin.module.css';

const USERNAME_RULE = /^[A-Za-z0-9_.-]{2,30}$/;
const MIN_PASSWORD = 6;
const MAX_TURN_HOURS = 168;

function Notice({ notice }) {
  if (!notice) return null;
  const tone = notice.tone === 'error' ? ui.noticeError : notice.tone === 'success' ? ui.noticeSuccess : '';
  return (
    <p className={`${ui.notice} ${tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.text}
    </p>
  );
}

function Shell({ account, children }) {
  return (
    <main className={`${ui.theme} ${s.page}`}>
      <header className={s.header}>
        <img className={s.logo} src="/polymono-logo.webp" alt="" width="96" height="52" decoding="async" />
        <div className={s.heading}>
          <h1 className={s.title}>Admin</h1>
          {account && !account.isSpectator && <p className={s.subtitle}>Signed in as {account.username}</p>}
        </div>
        <a className={`${ui.btn} ${ui.ghost} ${ui.small}`} href="/">Back to the game</a>
      </header>
      {children}
    </main>
  );
}

/**
 * /admin: account management and game controls. It sits outside the game screens, so after a reload it
 * checks the saved token itself instead of waiting for the store to initialize.
 */
export default function Admin() {
  const storeUser = useGameStore(state => state.user);
  const storeIsAdmin = !!storeUser?.isAdmin;
  const [token] = useState(getToken);
  const [verified, setVerified] = useState(undefined); // undefined: not checked yet, null: no valid session

  useEffect(() => {
    if (storeIsAdmin || !token) return;
    let live = true;
    api('/auth/verify', { token })
      .then(data => { if (live) setVerified(data?.user ?? null); })
      .catch(() => { if (live) setVerified(null); });
    return () => { live = false; };
  }, [storeIsAdmin, token]);

  const account = storeIsAdmin ? storeUser : verified || storeUser || null;
  const checking = !storeIsAdmin && !!token && verified === undefined;

  if (checking) {
    return (
      <Shell>
        <p className={ui.notice} role="status">Checking your account…</p>
      </Shell>
    );
  }

  if (!account?.isAdmin) {
    return (
      <Shell account={account}>
        <section className={`${ui.panel} ${s.section}`}>
          <h2 className={s.sectionTitle}>Log in as an admin</h2>
          <p className={s.copy}>
            {account && !account.isSpectator
              ? `${account.username} is not an admin account. Log out of the game and log in with an admin account to manage players.`
              : 'This page is for the game admin. Log in with an admin account, then come back to /admin.'}
          </p>
          <a className={`${ui.btn} ${ui.primary}`} href="/">Go to the login page</a>
        </section>
      </Shell>
    );
  }

  return (
    <Shell account={account}>
      <AdminConsole me={account} />
    </Shell>
  );
}

function AdminConsole({ me }) {
  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState('');
  const [gameState, setGameState] = useState(null);
  const [gameError, setGameError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    api('/auth/users')
      .then(data => {
        if (!live) return;
        setUsers(Array.isArray(data) ? data : []);
        setUsersError('');
      })
      .catch(err => { if (live) setUsersError(err.message); });
    api('/game')
      .then(data => {
        if (!live) return;
        setGameState(data);
        setGameError('');
      })
      .catch(err => { if (live) setGameError(err.message); });
    return () => { live = false; };
  }, [reload]);

  const refresh = () => setReload(n => n + 1);

  return (
    <div className={s.sections}>
      <UsersSection users={users} error={usersError} me={me} onChanged={refresh} />
      <CreateUserSection users={users} onCreated={refresh} />
      <GameSection gameState={gameState} error={gameError} onState={setGameState} onChanged={refresh} />
    </div>
  );
}

// ---- accounts -----------------------------------------------------------------------------------------

function UsersSection({ users, error, me, onChanged }) {
  const [notice, setNotice] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [busy, setBusy] = useState(null); // 'password' | 'delete'
  const id = useId();

  function openPassword(userId) {
    setPasswordFor(current => (current === userId ? null : userId));
    setNewPassword('');
    setDeleteId(null);
    setNotice(null);
  }

  async function savePassword(event, user) {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD || busy) return;
    setBusy('password');
    setNotice(null);
    try {
      const result = await api(`/admin/users/${user.id}/password`, { method: 'POST', body: { newPassword } });
      setNotice({ tone: 'success', text: `${result?.message || `Password changed for ${user.username}`}. Let them know the new one.` });
      setPasswordFor(null);
      setNewPassword('');
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(user) {
    if (busy) return;
    setBusy('delete');
    setNotice(null);
    try {
      await api(`/auth/users/${user.id}`, { method: 'DELETE' });
      setNotice({ tone: 'success', text: `Deleted ${user.username}.` });
      setDeleteId(null);
      onChanged();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`${ui.panel} ${s.section}`} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-title`} className={s.sectionTitle}>Accounts</h2>
        {users && <span className={s.count}>{users.length}</span>}
      </div>

      <Notice notice={notice} />
      {error && <Notice notice={{ tone: 'error', text: `Could not load accounts: ${error}` }} />}
      {!users && !error && <p className={ui.hint}>Loading accounts…</p>}
      {users && users.length === 0 && <p className={ui.hint}>No accounts yet.</p>}

      {users && users.length > 0 && (
        <ul className={s.users}>
          {users.map(user => {
            const isMe = user.id === me?.id;
            const added = dayLabel(user.created_at);
            return (
              <li key={user.id} className={s.user}>
                <span className={s.token} aria-hidden="true">{tokenEmoji(user.token_type)}</span>
                <div className={s.userInfo}>
                  <p className={s.userName}>
                    <span>{user.username}</span>
                    {isMe && <span className={s.you}>(you)</span>}
                    {user.in_game && <span className={`${ui.badge} ${ui.badgeGold}`}>In game</span>}
                  </p>
                  <p className={s.userMeta}>
                    {tokenLabel(user.token_type)}
                    {added && ` · added ${added}`}
                    {user.in_game && ' · remove them from the game before deleting'}
                  </p>
                </div>
                <div className={s.userActions}>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.outline} ${ui.small}`}
                    onClick={() => openPassword(user.id)}
                    aria-expanded={passwordFor === user.id}
                    aria-controls={`${id}-pw-${user.id}`}
                  >
                    Reset password
                  </button>
                  {!isMe && deleteId !== user.id && (
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.dangerOutline} ${ui.small}`}
                      onClick={() => { setDeleteId(user.id); setPasswordFor(null); setNotice(null); }}
                      disabled={user.in_game || !!busy}
                      aria-label={`Delete ${user.username}`}
                    >
                      Delete
                    </button>
                  )}
                </div>

                {passwordFor === user.id && (
                  <form id={`${id}-pw-${user.id}`} className={s.inlineForm} onSubmit={e => savePassword(e, user)}>
                    <label className={ui.label} htmlFor={`${id}-pw-input-${user.id}`}>
                      New password for {user.username}
                    </label>
                    <div className={s.inlineRow}>
                      <input
                        id={`${id}-pw-input-${user.id}`}
                        className={ui.input}
                        type="text"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        minLength={MIN_PASSWORD}
                        aria-describedby={`${id}-pw-hint-${user.id}`}
                      />
                      <button
                        type="submit"
                        className={`${ui.btn} ${ui.primary}`}
                        disabled={newPassword.length < MIN_PASSWORD || !!busy}
                      >
                        {busy === 'password' ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={() => setPasswordFor(null)}>
                        Cancel
                      </button>
                    </div>
                    <p id={`${id}-pw-hint-${user.id}`} className={ui.hint}>
                      At least {MIN_PASSWORD} characters. It is shown as you type so you can pass it on.
                    </p>
                  </form>
                )}

                {deleteId === user.id && (
                  <div className={s.inlineForm}>
                    <ConfirmStep
                      message={`Delete ${user.username}'s account?`}
                      detail="This can't be undone. Their chat messages are deleted too."
                      confirmLabel="Delete account"
                      busy={busy === 'delete'}
                      busyLabel="Deleting…"
                      onConfirm={() => deleteUser(user)}
                      onCancel={() => setDeleteId(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CreateUserSection({ users, onCreated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const id = useId();

  const takenBy = new Map();
  for (const user of users || []) takenBy.set(user.token_type, user.username);
  const free = TOKEN_TYPES.filter(type => !takenBy.has(type));
  const tokenType = picked && !takenBy.has(picked) ? picked : free[0] || null;

  const trimmed = username.trim();
  const nameOk = USERNAME_RULE.test(trimmed);
  const passwordOk = password.length >= MIN_PASSWORD;
  const canSubmit = nameOk && passwordOk && !!tokenType && !busy && !!users;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setNotice(null);
    try {
      await api('/auth/register', { method: 'POST', body: { username: trimmed, password, tokenType } });
      setNotice({ tone: 'success', text: `Created ${trimmed}. They can log in now with the password you set.` });
      setUsername('');
      setPassword('');
      setPicked(null);
      onCreated();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${ui.panel} ${s.section}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle}>Add a player account</h2>
      <Notice notice={notice} />
      {users && free.length === 0 && (
        <p className={ui.notice}>All {TOKEN_TYPES.length} tokens are taken. Delete an account to free one up.</p>
      )}

      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <div className={s.formRow}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor={`${id}-name`}>Username</label>
            <input
              id={`${id}-name`}
              className={ui.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              aria-invalid={trimmed && !nameOk ? 'true' : undefined}
              aria-describedby={`${id}-name-hint`}
            />
            <p id={`${id}-name-hint`} className={trimmed && !nameOk ? ui.errorText : ui.hint}>
              2–30 letters, numbers, dots, dashes or underscores. Logins ignore capitals.
            </p>
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor={`${id}-password`}>Password</label>
            <input
              id={`${id}-password`}
              className={ui.input}
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={password && !passwordOk ? 'true' : undefined}
              aria-describedby={`${id}-password-hint`}
            />
            <p id={`${id}-password-hint`} className={password && !passwordOk ? ui.errorText : ui.hint}>
              At least {MIN_PASSWORD} characters.
            </p>
          </div>
        </div>

        <fieldset className={s.tokens}>
          <legend className={ui.label}>Token</legend>
          <div className={s.tokenGrid}>
            {TOKEN_TYPES.map(type => {
              const owner = takenBy.get(type);
              return (
                <label key={type} className={s.tokenOption}>
                  <input
                    className={ui.srOnly}
                    type="radio"
                    name={`${id}-token`}
                    value={type}
                    checked={tokenType === type}
                    disabled={!!owner}
                    onChange={() => setPicked(type)}
                  />
                  <span className={s.tokenFace}>
                    <span className={s.tokenEmoji} aria-hidden="true">{tokenEmoji(type)}</span>
                    <span className={s.tokenName}>{tokenLabel(type)}</span>
                    <span className={s.tokenOwner}>{owner ? `Taken by ${owner}` : 'Free'}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={!canSubmit}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </section>
  );
}

// ---- game -----------------------------------------------------------------------------------------------

function statusLine(gameState) {
  const game = gameState?.game;
  const players = gameState?.players || [];
  if (!game) return null;
  const seats = `${players.length} player${players.length === 1 ? '' : 's'}`;
  if (game.status === 'lobby') return `In the lobby with ${seats} seated.`;
  if (game.status === 'in_progress') {
    const current = players.find(p => p.user_id === game.current_turn_user_id);
    const started = game.started_at ? `, started ${dayLabel(game.started_at).toLowerCase()}` : '';
    return `In progress with ${seats}${started}.${current ? ` It is ${current.username}'s turn.` : ''}`;
  }
  if (game.status === 'completed') {
    const winner = players.find(p => p.user_id === game.winner_user_id);
    return `Finished.${winner ? ` ${winner.username} won.` : ''} Anyone from that game can set up a new one.`;
  }
  return null;
}

function GameSection({ gameState, error, onState, onChanged }) {
  const savedHours = gameState?.game?.settings?.turn_hours;
  const [hoursDraft, setHoursDraft] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetNotice, setResetNotice] = useState(null);
  const id = useId();

  const hoursValue = hoursDraft ?? (savedHours === undefined || savedHours === null ? '' : String(savedHours));
  const hours = hoursValue === '' ? NaN : Number(hoursValue);
  const hoursValid = Number.isInteger(hours) && hours >= 0 && hours <= MAX_TURN_HOURS;
  const hoursChanged = hoursValid && hours !== Number(savedHours);

  async function saveHours(event) {
    event.preventDefault();
    if (!hoursValid || settingsBusy) return;
    setSettingsBusy(true);
    setSettingsNotice(null);
    try {
      const result = await api('/admin/settings', { method: 'PATCH', body: { turn_hours: hours } });
      if (result?.state) onState(result.state);
      else onChanged();
      setHoursDraft(null);
      setSettingsNotice({
        tone: 'success',
        text: hours === 0 ? 'Turn timer off.' : `Turns now last ${hours} hour${hours === 1 ? '' : 's'}.`
      });
    } catch (err) {
      setSettingsNotice({ tone: 'error', text: err.message });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function resetGame() {
    if (resetBusy) return;
    setResetBusy(true);
    setResetNotice(null);
    try {
      const result = await api('/admin/reset-game', { method: 'POST' });
      if (result?.state) onState(result.state);
      else onChanged();
      setConfirmReset(false);
      setResetNotice({ tone: 'success', text: 'The game is back in the lobby. Everyone kept their seat.' });
    } catch (err) {
      setResetNotice({ tone: 'error', text: err.message });
    } finally {
      setResetBusy(false);
    }
  }

  const status = statusLine(gameState);

  return (
    <section className={`${ui.panel} ${s.section}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.sectionTitle}>Game</h2>
      {error && <Notice notice={{ tone: 'error', text: `Could not load the game: ${error}` }} />}
      {status && <p className={s.copy}>{status}</p>}

      <form className={s.subsection} onSubmit={saveHours}>
        <h3 className={s.subTitle}>Turn timer</h3>
        <Notice notice={settingsNotice} />
        <label className={ui.label} htmlFor={`${id}-hours`}>Hours per turn</label>
        <div className={s.inlineRow}>
          <input
            id={`${id}-hours`}
            className={`${ui.input} ${s.hoursInput}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={hoursValue}
            onChange={e => setHoursDraft(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
            aria-invalid={hoursValue !== '' && !hoursValid ? 'true' : undefined}
            aria-describedby={`${id}-hours-hint`}
            disabled={!gameState}
          />
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={!hoursChanged || settingsBusy}>
            {settingsBusy ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p id={`${id}-hours-hint`} className={hoursValue !== '' && !hoursValid ? ui.errorText : ui.hint}>
          0 means no limit; at most {MAX_TURN_HOURS} (a week). When time runs out the turn is skipped. A change applies
          from the next turn.
        </p>
      </form>

      <div className={`${s.subsection} ${s.danger}`}>
        <h3 className={s.subTitle}>Reset the game</h3>
        <Notice notice={resetNotice} />
        <p className={s.copy}>
          Ends the current game and returns everyone to the lobby. Players keep their seats, but money, properties,
          buildings, trades and the game log are cleared. Chat stays.
        </p>
        {confirmReset ? (
          <ConfirmStep
            message="Reset the game now?"
            detail="This can't be undone. Everyone goes back to the lobby."
            confirmLabel="Reset game"
            busy={resetBusy}
            busyLabel="Resetting…"
            onConfirm={resetGame}
            onCancel={() => setConfirmReset(false)}
          />
        ) : (
          <button
            type="button"
            className={`${ui.btn} ${ui.dangerOutline}`}
            onClick={() => { setConfirmReset(true); setResetNotice(null); }}
          >
            Reset game…
          </button>
        )}
      </div>
    </section>
  );
}
