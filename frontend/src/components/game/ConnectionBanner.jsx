import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import Icon from '../ui/Icon';
import './ui.css';

const SHOW_AFTER_MS = 3000; // a quick blip never shows
const BACK_ONLINE_MS = 2500;

/**
 * A slim lacquer strip under the top bar with a stop-red rule: "Reconnecting…" once the socket has been down
 * for a few seconds, then "Back online" in go, which hides itself. It never blocks taps (HTTP actions keep
 * working while it shows).
 */
export default function ConnectionBanner() {
  const { hasUser, connected } = useGameStore(useShallow(s => ({ hasUser: !!s.token, connected: s.connected })));
  const [down, setDown] = useState(false); // "Reconnecting…" is showing
  const [back, setBack] = useState(0); // bumps each time the connection returns after showing it
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    if (!hasUser || connected) return undefined;
    const timer = setTimeout(() => setDown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hasUser, connected]);

  if (down && (connected || !hasUser)) {
    setDown(false);
    if (connected) setBack(n => n + 1);
  }

  useEffect(() => {
    if (!back) return undefined;
    const timer = setTimeout(() => setHidden(back), BACK_ONLINE_MS);
    return () => clearTimeout(timer);
  }, [back]);

  if (!hasUser) return null;
  if (down && !connected) {
    return (
      <div className="g-conn" role="status">
        <span className="ui-spinner" aria-hidden="true" />
        <span>Reconnecting… the game will catch up when you are back.</span>
      </div>
    );
  }
  if (connected && back && hidden !== back) {
    return (
      <div className="g-conn g-conn--back" role="status">
        <Icon name="check" size={18} />
        <span>Back online</span>
      </div>
    );
  }
  return null;
}
