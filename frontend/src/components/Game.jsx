import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import useMediaQuery, { PHONE_QUERY } from '../hooks/useMediaQuery';
import useTurnSignals from '../hooks/useTurnSignals';
import Trade from './Trade';
import TopBar from './game/TopBar';
import PlayersPanel from './game/PlayersPanel';
import TurnActionPanel from './game/TurnActionPanel';
import SidePanel from './game/SidePanel';
import MyPropertiesDrawer from './game/MyPropertiesDrawer';
import TabBar from './game/TabBar';
import PropertySheet from './game/PropertySheet';
import PlayerSheet from './game/PlayerSheet';
import CardModal from './game/CardModal';
import AwayDigest from './game/AwayDigest';
import GameOver from './game/GameOver';
import BoardBoundary from './game/BoardBoundary';
import './game/game.css';
import './game/panel.css';
import './game/players.css';
import './game/feed.css';
import './game/deed.css';
import './game/sheets.css';

// three.js only loads once someone reaches the game screen. lazy() keeps a failed import failed for good, so
// retrying (BoardBoundary's "Try again") swaps in a fresh lazy component.
const lazyBoard = () => lazy(() => import('./Board'));
let sharedBoard = lazyBoard();

function selectChatUnread(s) {
  const me = s.user?.id;
  let n = 0;
  for (const m of s.chatMessages) if (m.id > s.chatReadId && m.user_id !== me) n++;
  return n;
}

/**
 * The game screen (also read-only for spectators), Midnight Deco.
 * Phone (to 899px): top bar, board, docked turn panel, tab bar, with Players / Activity / Chat / Mine as sheets
 * over the board (which stays mounted underneath). 900px: board | activity and chat, the players open from the
 * dial. 1100px: players and your holdings | board and the floating panel | activity and chat.
 */
export default function Game() {
  useTurnSignals();
  const { sheet, sideTab, status, isSpectator, tradeOpen, tradeOptions, closeTrade, markChatRead, resultsHidden, hideResults, closeSheet } = useGameStore(useShallow(s => ({
    sheet: s.sheet,
    closeSheet: s.closeSheet,
    sideTab: s.sideTab,
    status: s.game?.status,
    isSpectator: s.isSpectator,
    tradeOpen: s.tradeOpen,
    tradeOptions: s.tradeOptions,
    closeTrade: s.closeTrade,
    markChatRead: s.markChatRead,
    resultsHidden: s.resultsHidden,
    hideResults: s.hideResults
  })));
  const chatUnread = useGameStore(selectChatUnread);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [Board, setBoard] = useState(() => sharedBoard);
  const retryBoard = useCallback(() => {
    sharedBoard = lazyBoard();
    setBoard(() => sharedBoard);
  }, []);

  const chatVisible = sideTab === 'chat' && (!isPhone || sheet === 'side');
  useEffect(() => {
    if (chatVisible && chatUnread > 0) markChatRead();
  }, [chatVisible, chatUnread, markChatRead]);

  // Esc closes a sheet or drawer (Players, Activity, Mine) unless a dialog is open on top of it.
  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closeSheet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, closeSheet]);

  return (
    <div className="game" data-sheet={sheet || 'board'}>
      <TopBar />

      <aside className="g-pane players-pane" data-active={sheet === 'players'} aria-label="Players">
        <PlayersPanel />
      </aside>

      <main className="stage">
        <div className="board-area">
          <BoardBoundary onRetry={retryBoard}>
            <Suspense fallback={<div className="board-loading" role="status"><span className="ui-spinner" aria-hidden="true" />Loading the board…</div>}>
              <Board />
            </Suspense>
          </BoardBoundary>
        </div>
        <TurnActionPanel />
      </main>

      <SidePanel active={sheet === 'side'} chatUnread={chatVisible ? 0 : chatUnread} />
      {!isSpectator && <MyPropertiesDrawer open={sheet === 'mine'} />}
      <TabBar chatUnread={chatVisible ? 0 : chatUnread} />

      <PropertySheet />
      <PlayerSheet />
      <CardModal />
      <AwayDigest />
      {status === 'completed' && <GameOver open={!resultsHidden} onClose={hideResults} />}
      <Trade isOpen={tradeOpen} onClose={closeTrade} options={tradeOptions} />
    </div>
  );
}
