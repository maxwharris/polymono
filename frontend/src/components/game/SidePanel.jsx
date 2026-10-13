import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import Chat from '../Chat';
import ActivityFeed from './ActivityFeed';

/**
 * Activity and Chat. Desktop: the right column with its own tabs. Phone: the sheet behind the Activity and
 * Chat tabs of the bottom bar (which picks the pane). Both panes stay mounted so a chat draft survives.
 */
export default function SidePanel({ active, chatUnread }) {
  const { sideTab, setSideTab } = useGameStore(useShallow(s => ({ sideTab: s.sideTab, setSideTab: s.setSideTab })));

  const tab = (id, label, badge) => (
    <button
      type="button"
      role="tab"
      id={`side-tab-${id}`}
      aria-selected={sideTab === id}
      aria-controls={`side-pane-${id}`}
      className="side-tab"
      onClick={() => setSideTab(id)}
    >
      {label}
      {badge > 0 && <span className="g-badge">{badge}<span className="sr-only"> unread</span></span>}
    </button>
  );

  return (
    <section className="g-pane side" data-active={active} aria-label="Activity and chat">
      <div className="side-tabs" role="tablist" aria-label="Activity and chat">
        {tab('activity', 'Activity')}
        {tab('chat', 'Chat', chatUnread)}
      </div>
      <div id="side-pane-activity" role="tabpanel" aria-labelledby="side-tab-activity" className="side-pane side-pane--feed" hidden={sideTab !== 'activity'}>
        <ActivityFeed />
      </div>
      <div id="side-pane-chat" role="tabpanel" aria-labelledby="side-tab-chat" className="side-pane side-pane--chat" hidden={sideTab !== 'chat'}>
        <Chat />
      </div>
    </section>
  );
}
