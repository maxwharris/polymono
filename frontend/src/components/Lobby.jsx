import { useState, useEffect } from 'react';
import useGameStore from '../store/gameStore';

const Lobby = () => {
  const { user, players, game, toggleReady, startGame, logout, removePlayer } = useGameStore();
  const [myPlayer, setMyPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const player = players.find(p => p.user_id === user?.id);
    setMyPlayer(player);

    // First player (lowest turn order) is the host
    const sortedPlayers = [...players].sort((a, b) => a.turn_order - b.turn_order);
    const host = sortedPlayers[0];
    setIsHost(host?.user_id === user?.id);
  }, [players, user]);

  const readyPlayers = players.filter(p => p.ready_to_start);
  const allReady = players.length >= 2 && readyPlayers.length === players.length;

  const handleToggleReady = async () => {
    try {
      await toggleReady();
    } catch (error) {
      console.error('Failed to toggle ready:', error);
    }
  };

  const handleStartGame = async () => {
    try {
      await startGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleRemovePlayer = async (playerId) => {
    if (!window.confirm('Are you sure you want to remove this player?')) {
      return;
    }
    try {
      await removePlayer(playerId);
    } catch (error) {
      console.error('Failed to remove player:', error);
      alert(error.message || 'Failed to remove player');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.lobbyCard}>
        <div style={styles.header}>
          <img
            src="/polymono-logo.png"
            alt="PolyMono Logo"
            style={styles.logo}
          />
          <h1 style={styles.title}>POLYMONO</h1>
          <h2 style={styles.subtitle}>Manhattan Edition - Game Lobby</h2>
        </div>

        <div style={styles.content}>
          <div style={styles.info}>
            <p style={styles.infoText}>
              Waiting for players to join...
            </p>
            <p style={styles.infoSubtext}>
              Minimum 2 players required to start
            </p>
          </div>

          <div style={styles.playersSection}>
            <h3 style={styles.sectionTitle}>
              Players ({players.length}) {isHost && <span style={styles.hostBadge}>👑 You are the host</span>}
            </h3>
            <div style={styles.playersList}>
              {players.map(player => (
                <div
                  key={player.id}
                  style={{
                    ...styles.playerCard,
                    ...(player.user_id === user?.id ? styles.playerCardMe : {})
                  }}
                >
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>
                      {player.username}
                      {player.user_id === user?.id && ' (You)'}
                    </span>
                    <span style={styles.playerToken}>{getTokenEmoji(player.token_type)}</span>
                  </div>
                  <div style={styles.playerActions}>
                    {player.ready_to_start ? (
                      <span style={styles.readyBadge}>✓ Ready</span>
                    ) : (
                      <span style={styles.notReadyBadge}>Waiting...</span>
                    )}
                    {isHost && player.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        style={styles.removeButton}
                        title="Remove player"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.actions}>
            {players.length < 2 && (
              <div style={styles.warningBox}>
                ⚠️ Need at least 2 players to start
              </div>
            )}

            <div style={styles.buttonRow}>
              <button
                onClick={handleLogout}
                style={styles.logoutButton}
              >
                ← Logout
              </button>

              <button
                onClick={handleToggleReady}
                style={{
                  ...styles.readyButton,
                  ...(myPlayer?.ready_to_start ? styles.readyButtonActive : {})
                }}
              >
                {myPlayer?.ready_to_start ? '✓ Ready' : 'Ready Up'}
              </button>
            </div>

            {allReady && (
              <button
                onClick={handleStartGame}
                style={styles.startButton}
                className="pulse"
              >
                🎮 Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function getTokenEmoji(tokenType) {
  const tokens = {
    car: '🚗',
    hat: '🎩',
    dog: '🐕',
    ship: '🚢',
    thimble: '🎲',
  };
  return tokens[tokenType] || '🎮';
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--monopoly-dark-green) 0%, var(--bg-primary) 100%)',
  },
  lobbyCard: {
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
    border: '3px solid var(--monopoly-gold)',
    borderRadius: 'var(--radius-lg)',
    padding: '3rem',
    minWidth: '600px',
    maxWidth: '800px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
    borderBottom: '2px solid var(--monopoly-gold)',
    paddingBottom: '1.5rem',
  },
  logo: {
    width: '120px',
    height: 'auto',
    marginBottom: '1rem',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
  },
  title: {
    fontSize: '3rem',
    margin: 0,
    background: 'linear-gradient(135deg, var(--monopoly-gold) 0%, var(--monopoly-dark-gold) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '1.5rem',
    color: 'var(--text-secondary)',
    margin: '0.5rem 0 0 0',
    fontWeight: '600',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  info: {
    textAlign: 'center',
    padding: '1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--radius-md)',
  },
  infoText: {
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
    fontWeight: '600',
  },
  infoSubtext: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  playersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    color: 'var(--monopoly-gold)',
    margin: 0,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  hostBadge: {
    fontSize: '0.9rem',
    color: 'var(--monopoly-gold)',
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 'normal',
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  playerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.3s ease',
  },
  playerCardMe: {
    border: '2px solid var(--monopoly-gold)',
    background: 'rgba(212,175,55,0.1)',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  playerName: {
    fontSize: '1.1rem',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  playerToken: {
    fontSize: '1.5rem',
  },
  playerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  readyBadge: {
    padding: '0.5rem 1rem',
    background: 'var(--monopoly-green)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
  notReadyBadge: {
    padding: '0.5rem 1rem',
    background: 'rgba(255,255,255,0.1)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
  },
  removeButton: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(227,30,36,0.2)',
    border: '2px solid var(--monopoly-red)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--monopoly-red)',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1rem',
  },
  warningBox: {
    padding: '1rem',
    background: 'rgba(227,30,36,0.2)',
    border: '2px solid var(--monopoly-red)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: '600',
  },
  buttonRow: {
    display: 'flex',
    gap: '1rem',
  },
  logoutButton: {
    flex: '0 0 auto',
    padding: '1rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.3)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  readyButton: {
    flex: '1',
    padding: '1rem 2rem',
    fontSize: '1.25rem',
    fontWeight: '700',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--monopoly-gold)',
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  readyButtonActive: {
    background: 'linear-gradient(135deg, var(--monopoly-green) 0%, var(--monopoly-dark-green) 100%)',
    color: 'white',
    border: '2px solid var(--monopoly-green)',
  },
  startButton: {
    padding: '1.25rem 2rem',
    fontSize: '1.5rem',
    fontWeight: '800',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    color: '#1a1a1a',
    cursor: 'pointer',
    boxShadow: '0 0 30px rgba(255,215,0,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
};

export default Lobby;
