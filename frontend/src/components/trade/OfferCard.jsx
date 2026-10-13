import { useId } from 'react';
import ConfirmStep from '../screens/ConfirmStep';
import { isoString, shortWhen } from '../screens/time';
import { describeSide } from './tradeUtils';
import { PlayerTag, TermsList } from './TradeTerms';
import ui from '../screens/ui.module.css';
import s from './Trade.module.css';

/**
 * A pending trade, always written from my side: "You give" and "You get". Received offers can be
 * accepted (after a confirm step), countered or rejected; sent ones can be cancelled.
 */
export default function OfferCard({
  trade,
  view,
  other,
  byId,
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
  const name = other?.username || view.other.username;
  const received = !view.iProposed;
  const blocked = problems.length > 0;

  return (
    <article className={`${s.offer} ${highlight ? s.highlight : ''}`} aria-labelledby={headingId}>
      <header className={s.offerHead}>
        <h3 id={headingId} className={s.offerTitle}>
          {received ? (
            <><PlayerTag player={other} fallbackName={view.other.username} /> <span>offers you a trade</span></>
          ) : (
            <><span>Your offer to</span> <PlayerTag player={other} fallbackName={view.other.username} /></>
          )}
        </h3>
        <div className={s.offerMeta}>
          {trade.countered_from && <span className={`${ui.badge} ${ui.badgeInfo}`}>Counter-offer</span>}
          <time dateTime={isoString(trade.created_at)}>{shortWhen(trade.created_at)}</time>
        </div>
      </header>

      <div className={s.offerSides}>
        <section className={s.offerSide} aria-label="You give">
          <h4 className={s.giveLabel}>You give</h4>
          <TermsList side={view.give} byId={byId} />
        </section>
        <span className={s.swap} aria-hidden="true">⇄</span>
        <section className={s.offerSide} aria-label="You get">
          <h4 className={s.getLabel}>You get</h4>
          <TermsList side={view.get} byId={byId} />
        </section>
      </div>

      {blocked && (
        <div className={s.problems}>
          <p className={s.problemsTitle}>
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
              <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={onAccept} disabled={blocked || !!busy}>
                Accept
              </button>
              <button type="button" className={`${ui.btn} ${ui.outline}`} onClick={onCounter} disabled={!!busy}>
                Counter
              </button>
              <button type="button" className={`${ui.btn} ${ui.dangerOutline}`} onClick={onReject} disabled={!!busy}>
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          )
        ) : (
          <>
            <p className={s.waitingNote}>Waiting for {name} to answer.</p>
            <button type="button" className={`${ui.btn} ${ui.dangerOutline}`} onClick={onWithdraw} disabled={!!busy}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel offer'}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
