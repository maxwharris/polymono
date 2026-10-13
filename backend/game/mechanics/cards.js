/**
 * Opportunity (chance) and Community Fund cards. Decks are shuffled and persisted in game.decks so the
 * order survives restarts; a Get Out of Jail Free card stays out of its deck while a player holds it.
 * The engine applies the effects.
 */

const CHANCE_CARDS = [
  { type: 'advance', position: 0, text: "Advance to New Year's Eve (Collect $200)" },
  { type: 'advance', position: 24, text: 'Advance to Bryant Park. If you pass New Year\'s Eve, collect $200' },
  { type: 'advance', position: 11, text: 'Advance to Chelsea. If you pass New Year\'s Eve, collect $200' },
  { type: 'nearest', kind: 'railroad', text: 'Advance to the nearest Subway Station. If unowned, you may buy it. If owned, pay the owner twice the rent' },
  { type: 'nearest', kind: 'railroad', text: 'Advance to the nearest Subway Station. If unowned, you may buy it. If owned, pay the owner twice the rent' },
  { type: 'nearest', kind: 'utility', text: 'Advance to the nearest Utility. If unowned, you may buy it. If owned, roll the dice and pay the owner ten times the roll' },
  { type: 'back', spaces: 3, text: 'Go back three spaces' },
  { type: 'jail', text: 'Go directly to Rikers Island. Do not pass New Year\'s Eve, do not collect $200' },
  { type: 'jail_free', text: 'Get out of Rikers Island free. This card may be kept until needed or traded' },
  { type: 'money', amount: 50, text: 'Bank pays you a dividend of $50' },
  { type: 'money', amount: -15, text: 'Speeding fine $15' },
  { type: 'advance', position: 25, text: 'Take a trip to Times Square Station. If you pass New Year\'s Eve, collect $200' },
  { type: 'pay_each', amount: 50, text: 'You have been elected Mayor. Pay each player $50' },
  { type: 'money', amount: 150, text: 'Your building loan matures. Collect $150' },
  { type: 'money', amount: -15, text: 'Pay a Jaywalking Fine of $15' },
  { type: 'repairs', house: 25, hotel: 100, text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100' },
  { type: 'advance', position: 39, text: 'Advance to One World Trade Center' },
  { type: 'advance', position: 32, text: 'Take a walk on the High Line. Advance to Highline. If you pass New Year\'s Eve, collect $200' },
  { type: 'advance', position: 1, text: 'Advance to Alphabet City. If you pass New Year\'s Eve, collect $200' }
];

const COMMUNITY_CHEST_CARDS = [
  { type: 'advance', position: 0, text: "Time flies... Advance to New Year's Eve (Collect $200)" },
  { type: 'money', amount: 200, text: 'Bank error in your favor. Collect $200' },
  { type: 'money', amount: -50, text: 'Doctor\'s fee. Pay $50' },
  { type: 'money', amount: 50, text: 'From sale of stock you get $50' },
  { type: 'jail_free', text: 'Get out of Rikers Island free. This card may be kept until needed or traded' },
  { type: 'jail', text: 'Go directly to Rikers Island. Do not pass New Year\'s Eve, do not collect $200' },
  { type: 'collect_each', amount: 10, text: 'It is your birthday. Collect $10 from every player' },
  { type: 'money', amount: 100, text: 'You inherit a Rent-Controlled Apartment. Collect $100' },
  { type: 'money', amount: 100, text: 'You fell in a pothole! Collect $100' },
  { type: 'collect_each', amount: 50, text: 'Opening night at Lincoln Center. Collect $50 from every player for tickets' },
  { type: 'money', amount: 100, text: 'Life insurance matures. Collect $100' },
  { type: 'money', amount: -100, text: 'Pay hospital fees of $100' },
  { type: 'money', amount: -50, text: 'Pay for a private school. Pay $50' },
  { type: 'money', amount: 25, text: 'Receive $25 consultancy fee' },
  { type: 'repairs', house: 40, hotel: 115, text: 'You are assessed for street repairs. $40 per house. $115 per hotel' },
  { type: 'money', amount: 10, text: 'You have won second prize in a Broadway talent contest. Collect $10' },
  { type: 'money', amount: -150, text: 'Pay your Property Tax of $150' }
];

const DECKS = { chance: CHANCE_CARDS, community: COMMUNITY_CHEST_CARDS };

function shuffledIndices(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshDecks() {
  return {
    chance: { order: shuffledIndices(CHANCE_CARDS.length), pos: 0 },
    community: { order: shuffledIndices(COMMUNITY_CHEST_CARDS.length), pos: 0 },
    held: { chance: 0, community: 0 }
  };
}

/** Draws the next card from `deckName`, mutating `decks`. Reshuffles when the deck runs out. */
function drawCard(decks, deckName) {
  const cards = DECKS[deckName];
  decks.held = decks.held || { chance: 0, community: 0 };
  let deck = decks[deckName];
  if (!deck || !Array.isArray(deck.order) || deck.order.length !== cards.length) {
    deck = decks[deckName] = { order: shuffledIndices(cards.length), pos: 0 };
  }
  for (let tries = 0; tries <= cards.length; tries++) {
    if (deck.pos >= deck.order.length) {
      deck.order = shuffledIndices(cards.length);
      deck.pos = 0;
    }
    const card = cards[deck.order[deck.pos++]];
    if (card.type === 'jail_free' && decks.held[deckName] > 0) continue; // a player is holding it
    if (card.type === 'jail_free') decks.held[deckName]++;
    return card;
  }
  throw new Error('Card deck is empty');
}

/** A used (or bankrupt player's) Get Out of Jail Free card goes back into whichever deck is missing one. */
function returnJailCard(decks, count = 1) {
  decks.held = decks.held || { chance: 0, community: 0 };
  for (let i = 0; i < count; i++) {
    const deckName = decks.held.chance > 0 ? 'chance' : 'community';
    decks.held[deckName] = Math.max(0, decks.held[deckName] - 1);
  }
}

module.exports = { CHANCE_CARDS, COMMUNITY_CHEST_CARDS, freshDecks, drawCard, returnJailCard };
