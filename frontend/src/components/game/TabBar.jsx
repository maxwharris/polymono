import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';

/** Phone navigation: Board · Players · Activity · Chat · Mine. Every tab but Board opens a sheet over it. */
export default function TabBar({ chatUnread }) {
  const { sheet, sideTab, openSheet, closeSheet, setSideTab, phase } = useGameStore(useShallow(s => ({
    sheet: s.sheet,
    sideTab: s.sideTab,
    openSheet: s.openSheet,
    closeSheet: s.closeSheet,
    setSideTab: s.setSideTab,
    phase: s.game?.turn_state?.phase
  })));
  const me = useGameStore(selectMyPlayer);
  const isMyTurn = useGameStore(selectIsMyTurn);

  const current = sheet === 'side' ? sideTab : sheet || 'board';
  const go = (id) => {
    if (id === 'board') closeSheet();
    else if (id === 'activity' || id === 'chat') {
      setSideTab(id);
      openSheet('side');
    } else openSheet(id);
  };

  const tabs = [
    { id: 'board', icon: '🎲', label: 'Board', dot: isMyTurn && current !== 'board' },
    { id: 'players', icon: '👥', label: 'Players' },
    { id: 'activity', icon: '📜', label: 'Activity' },
    { id: 'chat', icon: '💬', label: 'Chat', badge: chatUnread },
    ...(me ? [{ id: 'mine', icon: '🏘️', label: 'Mine', dot: isMyTurn && phase === 'debt' }] : [])
  ];

  return (
    <nav className="tabbar" aria-label="Game sections">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className="tabbar-item"
          aria-current={current === t.id ? 'page' : undefined}
          onClick={() => go(t.id)}
        >
          <span className="tabbar-icon" aria-hidden="true">{t.icon}</span>
          <span className="tabbar-label">{t.label}</span>
          {t.badge > 0 && (
            <span className="g-badge tabbar-badge">{t.badge > 9 ? '9+' : t.badge}<span className="sr-only"> unread</span></span>
          )}
          {t.dot && <span className="tabbar-dot"><span className="sr-only"> (needs you)</span></span>}
        </button>
      ))}
    </nav>
  );
}
