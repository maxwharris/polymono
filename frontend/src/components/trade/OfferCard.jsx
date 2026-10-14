import { useId } from 'react';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import ConfirmStep from '../screens/ConfirmStep';
import { isoString, shortWhen } from '../screens/time';
import { completedSets, describeSide } from './tradeUtils';
import { DealSentence, OfferSlip } from './TradeTerms';
import s from './Trade.module.css';

/**
 * A pending trade, always written from my side. The paper offer slip shows the deal at a glance, the plain
 * sentence under it says it (and is what assistive tech reads). Received offers can be accepted (after a
 * confirm step), countered or declined; sent ones can be cancelled.
 */
export default function OfferCard({
  trade,
  view,
  other,
  byId,
  properties = [],
  myPlayerId = null,
  problems,
  busy,
  highlight = false,
  confirming,
  onAccept,
  onConfirmAccept,
  onCancelConfirm,
  onReject,
  onCounter,
  onWithdraw
}) {
  const headingId = useId();
  const reasonId = useId();
  const name = other?.username || view.other.username;
  const received = !view.iProposed;
  const blocked = problems.length > 0;
  const completes = completedSets(view.give, view.get, { properties, myPlayerId });

  return (
    <article className={`${s.offer} ${highlight ? s.highlight : ''}`} aria-labelledby={headingId}>
      <header className={s.offerHead}>
        {other ? <Medallion player={other} size={40} /> : <Medallion icon="user" size={40} />}
        <div className={s.offerHeadText}>
          <h3 id={headingId} className={s.offerTitle}>
            {received ? <>{name} offers you a trade</> : <>Your offer to {name}</>}
          </h3>
          <p className={s.offerMeta}>
            <time dateTime={isoString(trade.created_at)}>{shortWhen(trade.created_at)}</time>
            {trade.countered_from && <span className="ui-tag ui-tag--quiet">Counter-offer</span>}
          </p>
        </div>
      </header>

      <OfferSlip give={view.give} get={view.get} byId={byId} />
      <DealSentence give={view.give} get={view.get} byId={byId} completes={completes} />

      {blocked && (
        <div id={reasonId} className={s.problems}>
          <p className={s.problemsTitle}>
            <Icon name="info" size={18} />
            {received ? 'This trade cannot go through yet:' : `${name} cannot accept this yet:`}
          </p>
          <ul>
            {problems.map(problem => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      )}

      <footer className={s.offerActions}>
        {received ? (
          confirming ? (
            <ConfirmStep
              tone="primary"
              message={`Accept ${name}'s offer?`}
              detail={`You give ${describeSide(view.give, byId)} and get ${describeSide(view.get, byId)}. It happens right away.`}
              confirmLabel="Accept trade"
              busy={busy === 'accept'}
              busyLabel="Accepting…"
              onConfirm={onConfirmAccept}
              onCancel={onCancelConfirm}
            />
          ) : (
            <>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={onAccept}
                disabled={blocked || !!busy}
                aria-describedby={blocked ? reasonId : undefined}
              >
                Accept
              </button>
              <button type="button" className="ui-btn ui-btn--secondary" onClick={onCounter} disabled={!!busy}>
                Counter
              </button>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={onReject} disabled={!!busy}>
                {busy === 'reject' && <span className="ui-spinner" aria-hidden="true" />}
                {busy === 'reject' ? 'Declining…' : 'Decline'}
              </button>
            </>
          )
        ) : (
          <>
            <p className={s.waitingNote}>
              <Icon name="clock" size={18} />
              Waiting for {name} to answer.
            </p>
            <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={onWithdraw} disabled={!!busy}>
              {busy === 'cancel' && <span className="ui-spinner" aria-hidden="true" />}
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel offer'}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
