// How a live game event is presented to this client: a toast, the card modal (only for the player who drew
// it), and a sound. Pure: the store applies the result (and holds it while the board is still animating, so a
// toast never tells you where a token lands before you see it land). Other players' actions never block.
import { DECK_LABELS, spaceName } from './board';
import { eventText } from './events';
import { money } from './format';

/**
 * ctx: { userId, myPlayerId, players, properties }. userId is 0/undefined for spectators, so nothing is "mine".
 * Returns null or { toast?, card?: { id, deck, text }, sound? }, where toast is
 * { tone, title, body?, ttl?, actor? (user id whose medallion leads the toast), icon? (Icon name, for toasts
 * without a person), tradeId? (adds "Review the offer") }. ttl null = stays until dismissed.
 */
export function presentEvent(event, { userId, myPlayerId, players, properties }) {
  const d = event.data || {};
  const mine = !!userId && event.user_id === userId;
  const name = event.username || 'Someone';
  const actor = event.user_id ?? null;
  const propertyName = id => properties.find(p => p.id === id)?.name || '';
  const userName = uid => players.find(p => p.user_id === uid)?.username || 'Someone';
  const line = () => eventText(event, { myUserId: userId || null, players, properties }); // "You paid …", "… you …"

  switch (event.type) {
    case 'turn':
      return mine ? { sound: 'turn', toast: { tone: 'success', actor, title: "It's your turn", body: 'Roll when you are ready.' } } : null;

    case 'card': {
      // data.cardText is the card itself; event.text is the log line ("max drew …")
      const text = d.cardText || event.text;
      if (mine) return { card: { id: event.id, deck: d.deck, text }, sound: 'card' };
      return { toast: { tone: 'info', actor, title: `${name} drew ${DECK_LABELS[d.deck] || 'a card'}`, body: text } };
    }

    case 'rent': {
      if (!d.amount) return null;
      const place = propertyName(d.propertyId);
      if (userId && d.ownerUserId === userId) {
        return { sound: 'gain', toast: { tone: 'success', actor, title: `${name} paid you ${money(d.amount)} rent`, body: place ? `For ${place}` : undefined } };
      }
      if (mine) {
        return { sound: 'loss', toast: { tone: 'warn', actor: d.ownerUserId ?? null, title: `You paid ${userName(d.ownerUserId)} ${money(d.amount)} rent`, body: place ? `For ${place}` : undefined } };
      }
      return null;
    }

    case 'salary':
      return mine ? { sound: 'gain', toast: { tone: 'success', icon: 'note', title: `You collected ${money(d.amount)}`, body: `Your salary for passing ${spaceName(0)}` } } : null;

    case 'tax':
      return mine ? { sound: 'loss', toast: { tone: 'warn', icon: 'note', title: `You paid ${money(d.amount)} in tax`, body: line() } } : null;

    case 'jail':
      return mine ? { sound: 'loss', toast: { tone: 'warn', icon: 'bars', title: "You're in Rikers", body: line() } } : null;

    case 'turn_skipped':
      return mine
        ? { toast: { tone: 'warn', icon: 'clock', title: 'You ran out of time', body: d.autoplayed ? 'Your turn was played for you.' : 'Your turn was skipped.', ttl: null } }
        : null;

    case 'buy':
      return mine ? null : { toast: { tone: 'info', actor, title: `${name} bought ${propertyName(d.propertyId) || 'a property'}` } };

    case 'debt': {
      const creditors = d.creditorIds || (d.creditorId !== undefined ? [d.creditorId] : []);
      if (!mine && myPlayerId && creditors.includes(myPlayerId)) {
        return { toast: { tone: 'warn', actor, title: `${name} owes you money`, body: event.text } };
      }
      return null;
    }

    case 'debts_paid': {
      // payments: [{ creditorId (null = bank), creditorUserId, amount, reason }]
      if (mine || !userId) return null;
      const paid = (d.payments || []).filter(p => p.creditorUserId === userId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return paid > 0 ? { sound: 'gain', toast: { tone: 'success', actor, title: `${name} paid you ${money(paid)}`, body: 'They paid what they owed you.' } } : null;
    }

    case 'bankrupt':
      return mine ? null : { toast: { tone: 'warn', actor, title: `${name} went bankrupt`, body: line() } };

    case 'trade_offer':
      if (userId && d.recipientUserId === userId) {
        return { sound: 'card', toast: { tone: 'info', actor, title: `${name} sent you an offer`, ttl: null, tradeId: d.tradeId } };
      }
      return null;

    case 'trade_countered':
      // logged by the player who countered; the new trade goes to the original proposer
      if (userId && d.recipientUserId === userId) {
        return { sound: 'card', toast: { tone: 'info', actor, title: `${name} sent you a counter-offer`, ttl: null, tradeId: d.tradeId } };
      }
      return null;

    case 'trade_accepted':
      // logged by the player who accepted (the recipient)
      if (userId && d.proposerUserId === userId) {
        return { sound: 'gain', toast: { tone: 'success', actor, title: `${event.username || userName(d.recipientUserId)} accepted your trade`, body: line() } };
      }
      return null;

    case 'trade_rejected':
      if (userId && d.proposerUserId === userId) {
        return { toast: { tone: 'warn', actor, title: `${name} turned down your offer` } };
      }
      return null;

    default:
      return null;
  }
}
