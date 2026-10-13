import { isoString, shortWhen } from '../screens/time';
import { STATUS_LABELS, describeSide, fromMySide } from './tradeUtils';
import { PlayerTag } from './TradeTerms';
import ui from '../screens/ui.module.css';
import s from './Trade.module.css';

// My last closed trades, newest first, each from my side.
export default function TradeHistory({ trades, myUserId, byId, playersById, focusId = null }) {
  if (!trades.length) {
    return <p className={s.empty}>No finished trades yet.</p>;
  }

  return (
    <ul className={s.history}>
      {trades.map(trade => {
        const view = fromMySide(trade, myUserId);
        const other = playersById.get(view.other.playerId);
        const done = trade.status === 'accepted';
        const when = trade.updated_at || trade.created_at;
        return (
          <li key={trade.id} className={`${s.historyRow} ${trade.id === focusId ? s.highlight : ''}`}>
            <div className={s.historyHead}>
              <span className={s.status} data-status={trade.status}>{STATUS_LABELS[trade.status] || trade.status}</span>
              <span className={s.historyWho}>
                {view.iProposed ? (
                  <>You <span aria-hidden="true">→</span><span className={ui.srOnly}> to </span> <PlayerTag player={other} fallbackName={view.other.username} /></>
                ) : (
                  <><PlayerTag player={other} fallbackName={view.other.username} /> <span aria-hidden="true">→</span><span className={ui.srOnly}> to </span> you</>
                )}
                {trade.countered_from && <span className={s.historyCounter}>(counter-offer)</span>}
              </span>
              <time className={s.historyTime} dateTime={isoString(when)}>{shortWhen(when)}</time>
            </div>
            <p className={s.historyTerms}>
              <span className={s.giveLabel}>{done ? 'You gave' : 'You give'}</span> {describeSide(view.give, byId)}
            </p>
            <p className={s.historyTerms}>
              <span className={s.getLabel}>{done ? 'You got' : 'You get'}</span> {describeSide(view.get, byId)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
