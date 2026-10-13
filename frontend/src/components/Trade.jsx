import useGameStore from '../store/gameStore';
import TradeDialog from './trade/TradeDialog';

/**
 * The trade window. `options` (all optional):
 *   { recipientPlayerId, requestedProperties: [propertyId] }  start an offer to someone, asking for those
 *   { tradeId }                                                open the tab holding that trade, highlighted
 *   { counterTradeId }                                         a received offer as a prefilled counter-offer
 * Each opening starts fresh.
 */
export default function Trade({ isOpen, onClose, options }) {
  const closeTrade = useGameStore(state => state.closeTrade);
  if (!isOpen) return null;
  const key = [
    options?.recipientPlayerId,
    options?.counterTradeId,
    options?.tradeId,
    Array.isArray(options?.requestedProperties) ? options.requestedProperties.join(',') : ''
  ].join(':');
  return <TradeDialog key={key} options={options} onClose={onClose || closeTrade} />;
}
