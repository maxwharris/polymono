import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { DECK_LABELS } from '../../lib/board';
import Modal from './Modal';

/**
 * The card I just drew. It waits until the Board has finished the dice and the walk (animating false) and
 * stays until dismissed. Other players see a toast instead (see lib/presenter.js).
 */
export default function CardModal() {
  const { card, animating, dismissCard } = useGameStore(useShallow(s => ({
    card: s.cardModal,
    animating: s.animating,
    dismissCard: s.dismissCard
  })));
  const titleId = useId();
  const open = !!card && !animating;
  const deck = card?.deck === 'community' ? 'community' : 'chance';

  return (
    <Modal open={open} onClose={dismissCard} labelledBy={titleId} className={`deck-card deck-card--${deck}`}>
      {card && (
        <>
          <header className="deck-card-head">
            <span className="deck-card-icon" aria-hidden="true">{deck === 'community' ? '🎁' : '❓'}</span>
            <h2 id={titleId} className="deck-card-title">{DECK_LABELS[deck]}</h2>
          </header>
          <p className="deck-card-text">{card.text}</p>
          <div className="g-modal-actions">
            <button type="button" className="g-btn g-btn--primary g-btn--large" onClick={dismissCard} autoFocus>OK</button>
          </div>
        </>
      )}
    </Modal>
  );
}
