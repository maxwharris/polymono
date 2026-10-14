import { useEffect, useId, useState } from 'react';
import useGameStore from '../store/gameStore';
import { api, getToken } from '../lib/api';
import { TOKEN_TYPES, tokenLabel } from '../lib/tokens';
import Icon from './ui/Icon';
import Medallion from './ui/Medallion';
import Wordmark from './ui/Wordmark';
import ConfirmDialog from './screens/ConfirmDialog';
import { dayLabel } from './screens/time';
import ui from './screens/ui.module.css';
import s from './screens/Admin.module.css';

const USERNAME_RULE = /^[A-Za-z0-9_.-]{2,30}$/;
const MIN_PASSWORD = 6;
const MAX_TURN_HOURS = 168;

const NOTICE_ICON = { error: 'warning', success: 'check' };

function Notice({ notice }) {
  if (!notice) return null;
  const tone = notice.tone === 'error' ? ui.noticeError : notice.tone === 'success' ? ui.noticeSuccess : '';
  return (
    <p className={`${ui.notice} ${tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <Icon name={NOTICE_ICON[notice.tone] || 'info'} size={18} />
      <span>{notice.text}</span>
    </p>
  );
}

function Shell({ account, children }) {
  return (
    <main className={`${ui.theme} ${s.page}`}>
      <header className={s.bar}>
        <Wordmark size="sm" sub="Admin" inline />
        <a className="ui-btn ui-btn--ghost" href="/">
          <Icon name="arrow-left" size={18} />
          Back to the game
        </a>
      </header>
      <div className={s.content}>
        <div className={s.intro}>
          <h1 className={`ui-display-l ${s.title}`}>Admin</h1>
          {account && !account.isSpectator && (
            <p className={s.subtitle}>
              <Icon name="shield" size={16} />
              Signed in as {account.username}
            </p>
          )}
        </div>
        {children}
      </div>
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
        <p className={s.checking} role="status">
          <span className="ui-spinner" aria-hidden="true" />
          Checking your account…
        </p>
      </Shell>
    );
  }

  if (!account?.isAdmin) {
    return (
      <Shell account={account}>
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Log in as an admin</h2>
          <p className={s.copy}>
            {account && !account.isSpectator
              ? `${account.username} is not an admin account. Log out of the game and log in with an admin account to manage players.`
              : 'This page is for the game admin. Log in with an admin account, then come back to /admin.'}
          </p>
          <a className={`ui-btn ui-btn--primary ${s.cta}`} href="/">Go to the login page</a>
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
  const seated = new Map((gameState?.players || []).map(p => [p.user_id, p]));

  return (
    <div className={s.sections}>
      <UsersSection users={users} error={usersError} me={me} seated={seated} onChanged={refresh} />
      <CreateUserSection users={users} error={usersError} onCreated={refresh} />
      <GameSection gameState={gameState} error={gameError} onState={setGameState} onChanged={refresh} />
    </div>
  );
}

// ---- accounts -----------------------------------------------------------------------------------------

function UsersSection({ users, error, me, seated, onChanged }) {
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
      setDeleteId(null);
    } finally {
      setBusy(null);
    }
  }

  const deleting = users?.find(u => u.id === deleteId) || null;
  const anyInGame = !!users?.some(u => u.in_game);

  return (
    <section className={s.section} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-title`} className={s.sectionTitle}>Accounts</h2>
        {users && <span className={s.count}>{users.length}</span>}
      </div>

      <Notice notice={notice} />
      {error && <Notice notice={{ tone: 'error', text: `Could not load accounts: ${error}` }} />}
      {!users && !error && <p className={s.checking}><span className="ui-spinner" aria-hidden="true" />Loading accounts…</p>}
      {users && users.length === 0 && <p className={s.copy}>No accounts yet.</p>}

      {users && users.length > 0 && (
        <ul className={s.users}>
          {users.map(user => {
            const isMe = user.id === me?.id;
            const day = dayLabel(user.created_at);
            const added = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day;
            const player = seated.get(user.id);
            return (
              <li key={user.id} className={s.user}>
                {player
                  ? <Medallion player={player} size={40} />
                  : <Medallion token={user.token_type} color="var(--slate)" size={40} />}
                <div className={s.userInfo}>
                  <p className={s.userName}>
                    <span className={s.userNameText}>{user.username}</span>
                    {isMe && <span className="ui-tag">you</span>}
                    {user.in_game && <span className="ui-tag ui-tag--quiet">In game</span>}
                  </p>
                  <p className={s.userMeta}>
                    {tokenLabel(user.token_type)}
                    {added && `, added ${added}`}
                  </p>
                </div>
                <div className={s.userActions}>
                  <button
                    type="button"
                    className="ui-btn ui-btn--secondary ui-btn--sm"
                    onClick={() => openPassword(user.id)}
                    aria-expanded={passwordFor === user.id}
                    aria-controls={`${id}-pw-${user.id}`}
                  >
                    <Icon name="key" size={18} />
                    Reset password
                  </button>
                  {!isMe && (
                    <button
                      type="button"
                      className="ui-btn ui-btn--danger ui-btn--sm"
                      onClick={() => { setDeleteId(user.id); setPasswordFor(null); setNotice(null); }}
                      disabled={user.in_game || !!busy}
                      aria-label={`Delete ${user.username}`}
                      aria-describedby={user.in_game ? `${id}-ingame` : undefined}
                    >
                      Delete
                    </button>
                  )}
                </div>

                {passwordFor === user.id && (
                  <form id={`${id}-pw-${user.id}`} className={s.inlineForm} onSubmit={e => savePassword(e, user)}>
                    <label className="ui-label" htmlFor={`${id}-pw-input-${user.id}`}>
                      New password for {user.username}
                    </label>
                    <div className={s.inlineRow}>
                      <input
                        id={`${id}-pw-input-${user.id}`}
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
                        className="ui-btn ui-btn--secondary"
                        disabled={newPassword.length < MIN_PASSWORD || !!busy}
                      >
                        {busy === 'password' && <span className="ui-spinner" aria-hidden="true" />}
                        {busy === 'password' ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setPasswordFor(null)}>
                        Cancel
                      </button>
                    </div>
                    <p id={`${id}-pw-hint-${user.id}`} className="ui-hint">
                      At least {MIN_PASSWORD} characters. It is shown as you type so you can pass it on.
                    </p>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {anyInGame && (
        <p id={`${id}-ingame`} className={`ui-hint ${s.listNote}`}>
          Accounts in the current game can't be deleted. Remove them from the game, or reset it, first.
        </p>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Delete ${deleting.username}'s account?` : ''}
        body="This can't be undone. Their chat messages are deleted too, and their token becomes free for a new account."
        confirmLabel="Delete account"
        busy={busy === 'delete'}
        busyLabel="Deleting…"
        onConfirm={() => deleting && deleteUser(deleting)}
        onCancel={() => setDeleteId(null)}
      />
    </section>
  );
}

function CreateUserSection({ users, error, onCreated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const id = useId();

  // Until the accounts load, nobody knows which tokens are free: no "Free" labels and no preselected token
  // that might flip to "Taken" a moment later.
  const loading = !users;
  const unknown = loading && !!error; // the accounts failed to load: the notice above says so
  const takenBy = new Map();
  for (const user of users || []) takenBy.set(user.token_type, user.username);
  const free = TOKEN_TYPES.filter(type => !takenBy.has(type));
  const tokenType = loading ? null : picked && !takenBy.has(picked) ? picked : free[0] || null;

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
    <section className={s.section} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-title`} className={s.sectionTitle}>Add a player account</h2>
      </div>
      <Notice notice={notice} />
      {users && free.length === 0 && (
        <Notice notice={{ tone: 'info', text: `All ${TOKEN_TYPES.length} tokens are taken. Delete an account to free one up.` }} />
      )}

      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <div className={s.formRow}>
          <div className="ui-field">
            <label className="ui-label" htmlFor={`${id}-name`}>Username</label>
            <input
              id={`${id}-name`}
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
            <p id={`${id}-name-hint`} className={trimmed && !nameOk ? 'ui-error' : 'ui-hint'}>
              2–30 letters, numbers, dots, dashes or underscores. Logins ignore capitals.
            </p>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={`${id}-password`}>Password</label>
            <input
              id={`${id}-password`}
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
            <p id={`${id}-password-hint`} className={password && !passwordOk ? 'ui-error' : 'ui-hint'}>
              At least {MIN_PASSWORD} characters.
            </p>
          </div>
        </div>

        <fieldset className={s.tokens} disabled={loading} aria-busy={(loading && !unknown) || undefined}>
          <legend className={`ui-label ${s.legend}`}>Token</legend>
          {loading && (
            <p className={s.tokensChecking}>
              {unknown ? "Can't tell which tokens are free until the accounts load." : <><span className="ui-spinner" aria-hidden="true" />Checking which tokens are free…</>}
            </p>
          )}
          <div className={`${s.tokenGrid} ${loading ? s.tokenGridLoading : ''}`}>
            {TOKEN_TYPES.map(type => {
              const owner = takenBy.get(type);
              const chosen = tokenType === type;
              return (
                <label key={type} className={s.tokenOption}>
                  <input
                    className="sr-only"
                    type="radio"
                    name={`${id}-token`}
                    value={type}
                    checked={chosen}
                    disabled={loading || !!owner}
                    onChange={() => setPicked(type)}
                  />
                  <span className={s.tokenFace}>
                    <Medallion token={type} color={chosen ? 'var(--brass-300)' : 'var(--slate)'} size={36} />
                    <span className={s.tokenText}>
                      <span className={s.tokenName}>{tokenLabel(type)}</span>
                      {loading
                        ? <span className={s.tokenOwnerPending} aria-hidden="true" />
                        : <span className={s.tokenOwner}>{owner ? `Taken by ${owner}` : 'Free'}</span>}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className={s.formActions}>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!canSubmit}>
            {busy ? <span className="ui-spinner" aria-hidden="true" /> : <Icon name="user-plus" size={20} />}
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </div>
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
      setConfirmReset(false);
    } finally {
      setResetBusy(false);
    }
  }

  const status = statusLine(gameState);

  return (
    <section className={s.section} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-title`} className={s.sectionTitle}>Game</h2>
      </div>
      {error && <Notice notice={{ tone: 'error', text: `Could not load the game: ${error}` }} />}
      {status && <p className={s.copy}>{status}</p>}

      <form className={s.subsection} onSubmit={saveHours}>
        <h3 className={s.subTitle}>
          <Icon name="clock" size={18} />
          Turn timer
        </h3>
        <Notice notice={settingsNotice} />
        <label className="ui-label" htmlFor={`${id}-hours`}>Hours per turn</label>
        <div className={s.inlineRow}>
          <input
            id={`${id}-hours`}
            className={s.hoursInput}
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
          <button type="submit" className="ui-btn ui-btn--secondary" disabled={!hoursChanged || settingsBusy}>
            {settingsBusy && <span className="ui-spinner" aria-hidden="true" />}
            {settingsBusy ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p id={`${id}-hours-hint`} className={hoursValue !== '' && !hoursValid ? 'ui-error' : 'ui-hint'}>
          0 means no limit; at most {MAX_TURN_HOURS} (a week). When time runs out the turn is played automatically. A
          change applies from the next turn.
        </p>
      </form>

      <div className={s.subsection}>
        <h3 className={`${s.subTitle} ${s.dangerTitle}`}>
          <Icon name="refresh" size={18} />
          Reset the game
        </h3>
        <Notice notice={resetNotice} />
        <p className={s.copy}>
          Ends the current game and returns everyone to the lobby. Players keep their seats, but money, properties,
          buildings, trades and the game log are cleared. Chat stays.
        </p>
        <div>
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={() => { setConfirmReset(true); setResetNotice(null); }}
          >
            Reset game…
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the game now?"
        body="This can't be undone. Everyone goes back to the lobby; money, properties, buildings, trades and the log are cleared."
        confirmLabel="Reset game"
        busy={resetBusy}
        busyLabel="Resetting…"
        onConfirm={resetGame}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}
