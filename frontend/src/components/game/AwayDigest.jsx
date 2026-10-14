import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { buildDigest } from '../../lib/events';
import { money, plural } from '../../lib/format';
import Icon from '../ui/Icon';
import { FeedLine } from './ActivityFeed';
import Modal from './Modal';
import './feed.css';
import './sheets.css';

/** "While you were away": shown on load or on return when at least a few things happened. */
export default function AwayDigest() {
  const { since, events, players, properties, userId, status, dismissDigest, openTrade, setSideTab, openSheet } = useGameStore(useShallow(s => ({
    since: s.awayDigestSince,
    events: s.events,
    players: s.players,
    properties: s.properties,
    userId: s.isSpectator ? null : s.user?.id,
    status: s.game?.status,
    dismissDigest: s.dismissDigest,
    openTrade: s.openTrade,
    setSideTab: s.setSideTab,
    openSheet: s.openSheet
  })));
  const me = useGameStore(selectMyPlayer);
  const isMyTurn = useGameStore(selectIsMyTurn);
  const titleId = useId();

  const digest = useMemo(
    () => (since == null ? null : buildDigest(events, since, userId, players, properties)),
    [since, events, userId, players, properties]
  );
  const open = !!digest && status === 'in_progress';

  return (
    <Modal open={open} onClose={dismissDigest} labelledBy={titleId} variant="sheet" className="digest">
      {digest && (
        <>
          <div className="ui-sheet__head">
            <h2 id={titleId} className="ui-sheet__title">While you were away</h2>
          </div>
          <p className="digest__sub">{plural(digest.turns, 'turn')} played and {plural(digest.count, 'thing')} happened.</p>
          <ul className="digest__facts">
            {me && <li><Icon name="note" size={20} /><span>You have <span className="ui-money">{money(me.money)}</span></span></li>}
            {digest.rentIn > 0 && <li><Icon name="note" size={20} /><span>You collected <span className="ui-money">{money(digest.rentIn)}</span> in rent</span></li>}
            {digest.rentOut > 0 && <li><Icon name="note" size={20} /><span>You paid <span className="ui-money">{money(digest.rentOut)}</span> in rent</span></li>}
            {digest.tradesForMe > 0 && <li className="is-brass"><Icon name="trade" size={20} /><span>{plural(digest.tradesForMe, 'trade offer')} for you</span></li>}
            {digest.purchases.slice(-4).map((text, i) => <li key={`buy-${i}`}><Icon name="house" size={20} /><span>{text}</span></li>)}
            {digest.bankruptcies.map((text, i) => <li key={`bk-${i}`}><Icon name="close" size={20} /><span>{text}</span></li>)}
            {digest.inJail.length > 0 && <li><Icon name="bars" size={20} /><span>In Rikers: {digest.inJail.join(', ')}</span></li>}
          </ul>
          {digest.highlights.length > 0 && (
            <>
              <h3 className="digest__h">Involving you</h3>
              <ul className="feed__lines digest__lines">
                {digest.highlights.map(line => <FeedLine key={line.id} line={line} mine />)}
              </ul>
            </>
          )}
          <div className="ui-sheet__actions">
            <button type="button" className="ui-btn ui-btn--primary" onClick={dismissDigest} data-autofocus>
              {isMyTurn ? 'Take your turn' : 'Got it'}
            </button>
            {digest.tradesForMe > 0 && (
              <button type="button" className="ui-btn ui-btn--secondary" onClick={() => { dismissDigest(); openTrade(); }}>
                See offers
              </button>
            )}
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => {
                dismissDigest();
                setSideTab('activity');
                openSheet('side');
              }}
            >
              Full log
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
