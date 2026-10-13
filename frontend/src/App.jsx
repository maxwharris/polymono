import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from './store/gameStore';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Admin from './components/Admin';
import AppBoundary from './components/AppBoundary';
import Toaster from './components/game/Toaster';
import ConnectionBanner from './components/game/ConnectionBanner';
import Wordmark from './components/ui/Wordmark';

// Dev only: /specimen renders every token, icon, medallion, dial and surface of the design system.
// import.meta.env.DEV is false in a build, so the page is not bundled.
const Specimen = import.meta.env.DEV ? lazy(() => import('./components/ui/Specimen')) : null;

function Splash({ text, actions = false }) {
  const { resync, logout } = useGameStore(useShallow(s => ({ resync: s.resync, logout: s.logout })));
  return (
    <div className="splash" role="status">
      <Wordmark size="lg" />
      <p className="splash-text">{text}</p>
      {actions && (
        <div className="splash-actions">
          <button type="button" className="g-btn g-btn--secondary" onClick={() => resync()}>Try again</button>
          <button type="button" className="g-btn g-btn--ghost" onClick={() => logout()}>Log out</button>
        </div>
      )}
    </div>
  );
}

// No user → Login; lobby → Lobby; in progress or completed → Game (spectators too, read-only).
function GameRouter() {
  const { ready, hasUser, status } = useGameStore(useShallow(s => ({ ready: s.ready, hasUser: !!s.user, status: s.game?.status })));
  if (!ready) return <Splash text="Loading…" />;
  if (!hasUser) return <Login />;
  if (!status) return <Splash text="Loading the game…" actions />;
  if (status === 'lobby') return <Lobby />;
  return <Game />;
}

export default function App() {
  useEffect(() => {
    useGameStore.getState().initialize();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AppBoundary><Admin /></AppBoundary>} />
        {Specimen && <Route path="/specimen" element={<Suspense fallback={null}><Specimen /></Suspense>} />}
        <Route path="/" element={<AppBoundary><GameRouter /></AppBoundary>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ConnectionBanner />
      <Toaster />
    </BrowserRouter>
  );
}
