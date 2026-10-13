import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import './ui.css';

// "Reconnecting…" once the socket has been down for a few seconds. The delay is a CSS animation-delay,
// so a quick blip never shows.
export default function ConnectionBanner() {
  const { hasUser, connected } = useGameStore(useShallow(s => ({ hasUser: !!s.token, connected: s.connected })));
  if (!hasUser || connected) return null;
  return (
    <div className="g-conn" role="status">
      <span className="g-spinner" aria-hidden="true" /> Reconnecting… the game will catch up when you're back.
    </div>
  );
}
