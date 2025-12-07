import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useGameStore from './store/gameStore';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Game from './components/Game';
import SpectatorView from './components/SpectatorView';
import Admin from './components/Admin';

function GameRouter() {
  const { user, game, isSpectator, initialize } = useGameStore();

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Show login if no user
  if (!user) {
    return <Login />;
  }

  // Show spectator view if in spectator mode
  if (isSpectator) {
    return <SpectatorView />;
  }

  // Show lobby if game is in lobby status
  if (game?.status === 'lobby') {
    return <Lobby />;
  }

  // Show game if game is in progress
  return <Game />;
}

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/" element={<GameRouter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
