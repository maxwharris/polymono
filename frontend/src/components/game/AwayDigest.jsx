import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { buildDigest, eventIcon } from '../../lib/events';
import { money, plural } from '../../lib/format';
import Modal from './Modal';

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
    <Modal open={open} onClose={dismissDigest} labelledBy={titleId} className="digest">
      {digest && (
        <>
          <h2 id={titleId} className="g-modal-title">While you were away</h2>
          <p className="g-modal-sub">{plural(digest.turns, 'turn')} played, {plural(digest.count, 'thing')} happened.</p>
          <ul className="digest-facts">
            {me && <li><span aria-hidden="true">💵</span> You have <strong className="money">{money(me.money)}</strong></li>}
            {digest.rentIn > 0 && <li><span aria-hidden="true">💰</span> You collected <strong className="money">{money(digest.rentIn)}</strong> in rent</li>}
            {digest.rentOut > 0 && <li><span aria-hidden="true">💸</span> You paid <strong className="money">{money(digest.rentOut)}</strong> in rent</li>}
            {digest.tradesForMe > 0 && <li><span aria-hidden="true">🤝</span> {plural(digest.tradesForMe, 'trade offer')} for you</li>}
            {digest.purchases.slice(-4).map((text, i) => <li key={`buy-${i}`}><span aria-hidden="true">🏠</span> {text}</li>)}
            {digest.bankruptcies.map((text, i) => <li key={`bk-${i}`}><span aria-hidden="true">💥</span> {text}</li>)}
            {digest.inJail.length > 0 && <li><span aria-hidden="true">🚓</span> In Rikers: {digest.inJail.join(', ')}</li>}
          </ul>
          {digest.highlights.length > 0 && (
            <>
              <h3 className="g-subtitle">Involving you</h3>
              <ul className="digest-lines">
                {digest.highlights.map(e => (
                  <li key={e.id}><span aria-hidden="true">{eventIcon(e)}</span> {e.text}</li>
                ))}
              </ul>
            </>
          )}
          <div className="g-modal-actions">
            <button
              type="button"
              className="g-btn g-btn--ghost"
              onClick={() => {
                dismissDigest();
                setSideTab('activity');
                openSheet('side');
              }}
            >
              Full log
            </button>
            {digest.tradesForMe > 0 && (
              <button type="button" className="g-btn g-btn--secondary" onClick={() => { dismissDigest(); openTrade(); }}>
                See offers
              </button>
            )}
            <button type="button" className="g-btn g-btn--primary" onClick={dismissDigest} autoFocus>
              {isMyTurn ? 'Take your turn' : 'Got it'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
