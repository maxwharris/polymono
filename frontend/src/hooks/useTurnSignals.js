import { useEffect } from 'react';
import useGameStore, { selectIsMyTurn } from '../store/gameStore';
import { setFavicon } from '../lib/favicon';

const TITLE = 'Polymono';

function lastId(list) {
  return list.length ? list[list.length - 1].id : 0;
}

/**
 * The tab title and favicon: "● Your turn – Polymono" (and a red dot on the icon) while it is my turn, and
 * "(3) …" for news that arrived while the tab was hidden. Sound for the turn itself comes from the event
 * presenter in the store. Runs as a store subscription, so it never re-renders anything.
 */
export default function useTurnSignals() {
  useEffect(() => {
    let unread = 0;

    const update = () => {
      const state = useGameStore.getState();
      const myTurn = selectIsMyTurn(state);
      const base = myTurn ? `● Your turn – ${TITLE}` : TITLE;
      const hidden = document.visibilityState === 'hidden';
      document.title = hidden && unread > 0 ? `(${unread}) ${base}` : base;
      setFavicon(myTurn);
    };

    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (document.visibilityState === 'hidden') {
        const me = state.user?.id;
        if (state.events !== prev.events) {
          const since = lastId(prev.events);
          unread += state.events.filter(e => e.id > since && e.text && e.user_id !== me).length;
        }
        if (state.chatMessages !== prev.chatMessages) {
          const since = lastId(prev.chatMessages);
          unread += state.chatMessages.filter(m => m.id > since && m.user_id !== me).length;
        }
      }
      if (state.game !== prev.game || state.events !== prev.events || state.chatMessages !== prev.chatMessages) update();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') unread = 0;
      update();
    };
    document.addEventListener('visibilitychange', onVisibility);
    update();

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      document.title = TITLE;
      setFavicon(false);
    };
  }, []);
}
