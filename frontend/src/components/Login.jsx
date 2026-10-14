import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import Icon from './ui/Icon';
import TurnDial from './ui/TurnDial';
import Wordmark from './ui/Wordmark';
import Skyline from './screens/Skyline';
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
      <div className={s.column}>
        <header className={s.brand}>
          <TurnDial size={176} sweep decorative className={s.emblem} />
          <Wordmark as="h1" size="xl" sub="Manhattan edition" className={s.wordmark} />
        </header>

        <form className={s.form} onSubmit={handleSubmit} noValidate>
          <div className="ui-field">
            <label className="ui-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
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

          <div className="ui-field">
            <label className="ui-label" htmlFor="login-password">Password</label>
            <div className={`ui-input ${s.secret}`}>
              <input
                id="login-password"
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
                className="ui-input__act"
                onClick={() => setShowPassword(v => !v)}
                aria-controls="login-password"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p id="login-error" className={`ui-error ${s.error}`} role="alert">
              <Icon name="warning" size={18} />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            className={`ui-btn ui-btn--primary ui-btn--lg ui-btn--block ${s.submit}`}
            disabled={!!pending}
            aria-busy={pending === 'login' || undefined}
          >
            {pending === 'login' && <span className="ui-spinner" aria-hidden="true" />}
            {pending === 'login' ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className={s.or}><span>or</span></p>

        <button
          type="button"
          className={`ui-btn ui-btn--secondary ui-btn--block ${s.spectate}`}
          onClick={handleSpectate}
          disabled={!!pending}
          aria-busy={pending === 'spectate' || undefined}
        >
          {pending === 'spectate' ? <span className="ui-spinner" aria-hidden="true" /> : <Icon name="eye" size={20} />}
          {pending === 'spectate' ? 'Opening…' : 'Watch as a spectator'}
        </button>
        <p className={`ui-hint ${s.footnote}`}>
          Spectators can see the board and read the chat. Accounts are set up by the game admin.
        </p>
      </div>
      <Skyline />
    </main>
  );
}
