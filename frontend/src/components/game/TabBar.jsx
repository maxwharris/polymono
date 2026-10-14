import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import Icon from '../ui/Icon';

/**
 * Phone navigation: Board, Players, Activity, Chat, Mine. Every tab but Board opens a sheet over the board.
 * Drawn icons over 11px labels; the active tab is brass with a lit bar on its top edge. Unread chat is a
 * stop-red count; "needs you" (your turn while elsewhere, or a debt on Mine) is a brass dot.
 */
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
    { id: 'board', icon: 'board', label: 'Board', dot: isMyTurn && current !== 'board' },
    { id: 'players', icon: 'players', label: 'Players' },
    { id: 'activity', icon: 'activity', label: 'Activity' },
    { id: 'chat', icon: 'chat', label: 'Chat', badge: chatUnread },
    ...(me ? [{ id: 'mine', icon: 'deed', label: 'Mine', dot: isMyTurn && phase === 'debt' && current !== 'mine', flight: '1' }] : [])
  ];

  return (
    <nav className="tabbar" aria-label="Game sections">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className="tabbar__item"
          aria-current={current === t.id ? 'page' : undefined}
          onClick={() => go(t.id)}
          data-flight-target={t.flight}
        >
          <Icon name={t.icon} />
          <span className="tabbar__label">{t.label}</span>
          {t.badge > 0 && (
            <span className="ui-badge tabbar__badge">{t.badge > 9 ? '9+' : t.badge}<span className="sr-only"> unread</span></span>
          )}
          {t.dot && <span className="ui-dot tabbar__dot"><span className="sr-only"> (needs you)</span></span>}
        </button>
      ))}
    </nav>
  );
}
