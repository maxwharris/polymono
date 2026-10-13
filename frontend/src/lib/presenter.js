// How a live game event is presented to this client: a toast, the card modal (only for the player who drew
// it), and a sound. Pure: the store applies the result. Other players' actions never block the screen.
import { DECK_LABELS } from './board';
import { money } from './format';

/**
 * ctx: { userId, myPlayerId, players, properties }. userId is 0/undefined for spectators, so nothing is "mine".
 * Returns null or { toast?: { tone, icon, title, body, ttl, tradeId }, card?: { id, deck, text }, sound? }.
 * toast.ttl null = stays until dismissed; toast.tradeId = the toast gets a "View" button that opens it.
 */
export function presentEvent(event, { userId, myPlayerId, players, properties }) {
  const d = event.data || {};
  const mine = !!userId && event.user_id === userId;
  const name = event.username || 'Someone';
  const propertyName = id => properties.find(p => p.id === id)?.name || '';
  const userName = uid => players.find(p => p.user_id === uid)?.username || 'Someone';

  switch (event.type) {
    case 'turn':
      return mine ? { sound: 'turn', toast: { tone: 'success', icon: '▶', title: "It's your turn", ttl: 4000 } } : null;

    case 'card': {
      // data.cardText is the card itself; event.text is the log line ("max drew …")
      const text = d.cardText || event.text;
      if (mine) return { card: { id: event.id, deck: d.deck, text }, sound: 'card' };
      return { toast: { tone: 'info', icon: '🎴', title: `${name} drew ${DECK_LABELS[d.deck] || 'a card'}`, body: text, ttl: 6000 } };
    }

    case 'rent':
      if (!d.amount) return null;
      if (userId && d.ownerUserId === userId) {
        return { sound: 'gain', toast: { tone: 'success', icon: '💰', title: `+${money(d.amount)} rent from ${name}`, body: propertyName(d.propertyId) } };
      }
      if (mine) {
        return { sound: 'loss', toast: { tone: 'warn', icon: '💸', title: `-${money(d.amount)} rent to ${userName(d.ownerUserId)}`, body: propertyName(d.propertyId) } };
      }
      return null;

    case 'salary':
      return mine ? { sound: 'gain', toast: { tone: 'success', icon: '💰', title: `+${money(d.amount)} salary`, body: event.text } } : null;

    case 'tax':
      return mine ? { sound: 'loss', toast: { tone: 'warn', icon: '🧾', title: `-${money(d.amount)} tax`, body: event.text } } : null;

    case 'jail':
      return mine ? { sound: 'loss', toast: { tone: 'warn', icon: '🚓', title: 'You are in Rikers', body: event.text } } : null;

    case 'turn_skipped':
      return mine ? { toast: { tone: 'warn', icon: '⏰', title: 'You ran out of time', body: 'Your turn was skipped.', ttl: null } } : null;

    case 'buy':
      return mine ? null : { toast: { tone: 'info', icon: '🏠', title: `${name} bought ${propertyName(d.propertyId) || 'a property'}`, ttl: 3500 } };

    case 'debt': {
      const creditors = d.creditorIds || (d.creditorId !== undefined ? [d.creditorId] : []);
      if (!mine && myPlayerId && creditors.includes(myPlayerId)) {
        return { toast: { tone: 'warn', icon: '⚠️', title: `${name} owes you money`, body: event.text, ttl: 8000 } };
      }
      return null;
    }

    case 'debts_paid': {
      // payments: [{ creditorId (null = bank), creditorUserId, amount, reason }]
      if (mine || !userId) return null;
      const paid = (d.payments || []).filter(p => p.creditorUserId === userId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return paid > 0 ? { sound: 'gain', toast: { tone: 'success', icon: '💰', title: `+${money(paid)} from ${name}`, body: 'They paid what they owed you.' } } : null;
    }

    case 'bankrupt':
      return mine ? null : { toast: { tone: 'warn', icon: '💥', title: `${name} went bankrupt`, body: event.text, ttl: 8000 } };

    case 'trade_offer':
      if (userId && d.recipientUserId === userId) {
        return { sound: 'card', toast: { tone: 'info', icon: '🤝', title: `${name} sent you a trade offer`, ttl: null, tradeId: d.tradeId } };
      }
      return null;

    case 'trade_countered':
      // logged by the player who countered; the new trade goes to the original proposer
      if (userId && d.recipientUserId === userId) {
        return { sound: 'card', toast: { tone: 'info', icon: '🤝', title: `${name} sent you a counter-offer`, ttl: null, tradeId: d.tradeId } };
      }
      return null;

    case 'trade_accepted':
      // logged by the player who accepted (the recipient)
      if (userId && d.proposerUserId === userId) {
        return { sound: 'gain', toast: { tone: 'success', icon: '🤝', title: `${event.username || userName(d.recipientUserId)} accepted your trade`, body: event.text } };
      }
      return null;

    case 'trade_rejected':
      if (userId && d.proposerUserId === userId) {
        return { toast: { tone: 'warn', icon: '🤝', title: `${name} turned down your trade offer` } };
      }
      return null;

    default:
      return null;
  }
}
