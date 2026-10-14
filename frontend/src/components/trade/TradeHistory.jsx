import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { isoString, shortWhen } from '../screens/time';
import { STATUS_LABELS, fromMySide } from './tradeUtils';
import { DealSentence } from './TradeTerms';
import s from './Trade.module.css';

const STATUS_TAG = {
  accepted: 'ui-tag--go',
  rejected: 'ui-tag--stop',
  countered: '',
  pending: '',
  cancelled: 'ui-tag--quiet',
  expired: 'ui-tag--quiet'
};

// My last closed trades, newest first, each from my side, as flush rows.
export default function TradeHistory({ trades, myUserId, byId, playersById, focusId = null }) {
  if (!trades.length) {
    return (
      <div className={s.empty}>
        <Icon name="history" size={28} />
        <p>No finished trades yet.</p>
      </div>
    );
  }

  return (
    <ul className={s.history}>
      {trades.map(trade => {
        const view = fromMySide(trade, myUserId);
        const other = playersById.get(view.other.playerId);
        const name = other?.username || view.other.username;
        const done = trade.status === 'accepted';
        const when = trade.updated_at || trade.created_at;
        return (
          <li key={trade.id} className={`${s.historyRow} ${trade.id === focusId ? s.highlight : ''}`}>
            <div className={s.historyHead}>
              {other ? <Medallion player={other} size={28} /> : <Medallion icon="user" size={28} />}
              <p className={s.historyWho}>
                {view.iProposed ? <>You offered <b>{name}</b></> : <><b>{name}</b> offered you</>}
                {trade.countered_from && <span className={s.historyCounter}>, a counter-offer</span>}
              </p>
              <span className={`ui-tag ${STATUS_TAG[trade.status] ?? 'ui-tag--quiet'}`}>
                {STATUS_LABELS[trade.status] || trade.status}
              </span>
            </div>
            <DealSentence give={view.give} get={view.get} byId={byId} past={done} className={s.historyTerms} />
            <time className={s.historyTime} dateTime={isoString(when)}>{shortWhen(when)}</time>
          </li>
        );
      })}
    </ul>
  );
}
