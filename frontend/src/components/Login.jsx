import { useState } from 'react';
import useGameStore from '../store/gameStore';

// Backend API URL - use environment variable or default to domain
const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spectateLoading, setSpectateLoading] = useState(false);

  const { setUser, setToken, connectSocket, setSpectatorMode } = useGameStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        // Connect to WebSocket after successful login
        setTimeout(() => connectSocket(), 100);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSpectate = async () => {
    setSpectateLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/spectate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        setSpectatorMode(true);
        // Connect to WebSocket in spectator mode
        setTimeout(() => connectSocket(), 100);
      } else {
        setError(data.message || 'Failed to enter spectator mode');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSpectateLoading(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.loginCard} className="card">
        <div style={styles.header}>
          <img
            src="/polymono-logo.png"
            alt="PolyMono Logo"
            style={styles.logo}
          />
          <h1 style={styles.title}>POLYMONO</h1>
          <p style={styles.subtitle}>Manhattan Edition</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div style={styles.error} className="slide-in">
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.loginButton}>
            {loading ? (
              <>
                <span style={styles.spinner}></span>
                Logging in...
              </>
            ) : (
              'Enter Game'
            )}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        <button
          onClick={handleSpectate}
          disabled={spectateLoading}
          style={styles.spectateButton}
        >
          {spectateLoading ? (
            <>
              <span style={styles.spinner}></span>
              Entering spectator mode...
            </>
          ) : (
            <>
              <span style={styles.spectateIcon}>👁</span>
              Spectate Game
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  loginCard: {
    width: '100%',
    maxWidth: '480px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logo: {
    width: '120px',
    height: 'auto',
    marginBottom: '1rem',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, var(--monopoly-gold) 0%, var(--monopoly-dark-gold) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1.1rem',
    fontStyle: 'italic',
  },
  form: {
    marginBottom: '2rem',
  },
  inputGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.95rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  error: {
    background: 'linear-gradient(135deg, rgba(227, 30, 36, 0.2) 0%, rgba(183, 28, 28, 0.2) 100%)',
    border: '2px solid var(--monopoly-red)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: '#FFB3B3',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.95rem',
  },
  errorIcon: {
    fontSize: '1.2rem',
  },
  loginButton: {
    width: '100%',
    marginTop: '0.5rem',
  },
  divider: {
    position: 'relative',
    textAlign: 'center',
    margin: '2rem 0',
  },
  dividerText: {
    background: 'var(--card-bg)',
    padding: '0 1rem',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    letterSpacing: '0.1em',
    position: 'relative',
    zIndex: 1,
  },
  spectateButton: {
    width: '100%',
    background: 'linear-gradient(135deg, rgba(100, 100, 100, 0.3) 0%, rgba(60, 60, 60, 0.3) 100%)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    color: 'var(--text-primary)',
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  spectateIcon: {
    fontSize: '1.2rem',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: '0.5rem',
  },
};

export default Login;
