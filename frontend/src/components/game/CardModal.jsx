import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { DECK_LABELS } from '../../lib/board';
import Icon from '../ui/Icon';
import Modal from './Modal';
import './sheets.css';

/**
 * The card I just drew, as the paper card it is: the navy-and-gilt band of the Opportunity and Community
 * Fund tiles, then the card's words. It waits until the board has finished the dice and the walk (animating
 * false) and stays until dismissed. OK is printed on the card itself (navy like the band), so it never reads as
 * part of the turn panel under the scrim. Other players see a toast instead (lib/presenter.js).
 */
export default function CardModal() {
  const { card, animating, dismissCard } = useGameStore(useShallow(s => ({
    card: s.cardModal,
    animating: s.animating,
    dismissCard: s.dismissCard
  })));
  const titleId = useId();
  const textId = useId();
  const open = !!card && !animating;
  const deck = card?.deck === 'community' ? 'community' : 'chance';

  return (
    <Modal open={open} onClose={dismissCard} labelledBy={titleId} className="drawn">
      {card && (
        <>
          <article className={`drawn__card drawn__card--${deck}`} aria-describedby={textId}>
            <div className="drawn__in">
              <header className="drawn__band">
                <span className="drawn__emblem" aria-hidden="true"><Icon name={deck === 'community' ? 'card' : 'question'} size={26} /></span>
                <h2 id={titleId} className="drawn__title">{DECK_LABELS[deck]}</h2>
              </header>
              <p id={textId} className="drawn__text">{card.text}</p>
              <p className="drawn__foot">Polymono, Manhattan edition</p>
            </div>
            <button type="button" className="ui-btn ui-btn--lg ui-btn--block drawn__ok" onClick={dismissCard} data-autofocus>OK</button>
          </article>
        </>
      )}
    </Modal>
  );
}
