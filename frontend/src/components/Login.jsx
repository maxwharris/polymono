import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import ui from './screens/ui.module.css';
import s from './screens/Login.module.css';

export default function Login() {
  const { login, spectate } = useGameStore(useShallow(state => ({ login: state.login, spectate: state.spectate })));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(null); // 'login' | 'spectate'
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setPending('login');
    setError('');
    try {
      await login(username.trim(), password);
      // On success the app swaps this screen out.
    } catch (err) {
      setError(err?.message || 'Could not log in. Try again.');
      setPending(null);
    }
  }

  async function handleSpectate() {
    if (pending) return;
    setPending('spectate');
    setError('');
    try {
      await spectate();
    } catch (err) {
      setError(err?.message || 'Could not open spectator mode.');
      setPending(null);
    }
  }

  return (
    <main className={`${ui.theme} ${s.page}`}>
      <div className={`${ui.panel} ${s.card}`}>
        <header className={s.brand}>
          <img className={ui.logo} src="/polymono-logo.webp" alt="" width="168" height="92" decoding="async" />
          <h1 className={s.title}>Polymono</h1>
          <p className={s.subtitle}>Manhattan Edition</p>
        </header>

        <form className={s.form} onSubmit={handleSubmit} noValidate>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className={ui.input}
              type="text"
              name="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              required
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="login-password">Password</label>
            <div className={s.passwordRow}>
              <input
                id="login-password"
                className={ui.input}
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
              <button
                type="button"
                className={`${ui.btn} ${ui.ghost} ${ui.small} ${s.reveal}`}
                onClick={() => setShowPassword(v => !v)}
                aria-pressed={showPassword}
                aria-controls="login-password"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p id="login-error" className={`${ui.notice} ${ui.noticeError}`} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.block}`} disabled={!!pending}>
            {pending === 'login' ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className={s.divider} role="presentation"><span>or</span></div>

        <button
          type="button"
          className={`${ui.btn} ${ui.outline} ${ui.block}`}
          onClick={handleSpectate}
          disabled={!!pending}
        >
          {pending === 'spectate' ? 'Opening…' : 'Watch as spectator'}
        </button>
        <p className={`${ui.hint} ${s.footnote}`}>
          Spectators can see the board and read the chat. Accounts are set up by the game admin.
        </p>
      </div>
    </main>
  );
}
