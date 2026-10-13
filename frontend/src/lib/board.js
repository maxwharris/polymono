// The 40 board spaces (mirrors backend/data/properties.js). Purchasable spaces also come from the server
// as `properties` (by position_on_board) with prices, owners and houses.
export const SPACES = [
  { position: 0, name: 'New Year\'s Eve', kind: 'go' },
  { position: 1, name: 'Alphabet City', kind: 'property', group: 'brown' },
  { position: 2, name: 'Community Fund', kind: 'community' },
  { position: 3, name: 'Meatpacking District', kind: 'property', group: 'brown' },
  { position: 4, name: 'City Income Tax', kind: 'tax' },
  { position: 5, name: 'Penn Station', kind: 'railroad' },
  { position: 6, name: 'Chinatown', kind: 'property', group: 'lightblue' },
  { position: 7, name: 'Opportunity', kind: 'chance' },
  { position: 8, name: 'Lower East Side', kind: 'property', group: 'lightblue' },
  { position: 9, name: 'East Village', kind: 'property', group: 'lightblue' },
  { position: 10, name: 'Rikers', kind: 'jail' },
  { position: 11, name: 'Chelsea', kind: 'property', group: 'pink' },
  { position: 12, name: 'Con Edison', kind: 'utility' },
  { position: 13, name: 'Flatiron District', kind: 'property', group: 'pink' },
  { position: 14, name: 'Gramercy Park', kind: 'property', group: 'pink' },
  { position: 15, name: 'Grand Central Station', kind: 'railroad' },
  { position: 16, name: 'Greenwich Village', kind: 'property', group: 'orange' },
  { position: 17, name: 'Community Fund', kind: 'community' },
  { position: 18, name: 'Hell\'s Kitchen', kind: 'property', group: 'orange' },
  { position: 19, name: 'Tribeca', kind: 'property', group: 'orange' },
  { position: 20, name: 'Lost and Found', kind: 'free' },
  { position: 21, name: 'SoHo', kind: 'property', group: 'red' },
  { position: 22, name: 'Opportunity', kind: 'chance' },
  { position: 23, name: 'Theater District', kind: 'property', group: 'red' },
  { position: 24, name: 'Bryant Park', kind: 'property', group: 'red' },
  { position: 25, name: 'Times Square Station', kind: 'railroad' },
  { position: 26, name: 'Lincoln Center', kind: 'property', group: 'yellow' },
  { position: 27, name: 'Columbus Circle', kind: 'property', group: 'yellow' },
  { position: 28, name: 'NYC Steam System', kind: 'utility' },
  { position: 29, name: 'Wall Street', kind: 'property', group: 'yellow' },
  { position: 30, name: 'Arrested by NYPD', kind: 'gotojail' },
  { position: 31, name: 'Upper West Side', kind: 'property', group: 'green' },
  { position: 32, name: 'Highline', kind: 'property', group: 'green' },
  { position: 33, name: 'Community Fund', kind: 'community' },
  { position: 34, name: 'Upper East Side', kind: 'property', group: 'green' },
  { position: 35, name: 'Union Square Station', kind: 'railroad' },
  { position: 36, name: 'Opportunity', kind: 'chance' },
  { position: 37, name: 'Billionaire\'s Row', kind: 'property', group: 'darkblue' },
  { position: 38, name: 'Penthouse Luxury Tax', kind: 'tax' },
  { position: 39, name: 'One World Trade Center', kind: 'property', group: 'darkblue' },
];

export const JAIL_POSITION = 10;

// The board's band colours, shared by the UI swatches and the 3D bands so the two agree. Brown and dark blue
// are lifted from the art's #8B4513 and #2B4BCB so they pass 3:1 on the navy UI; stations stay near-black
// and rely on the swatch's light inner ring (index.css --swatch-ring). index.css mirrors these as --g-*.
export const PROPERTY_COLORS = {
  brown: '#9C5B2E',
  lightblue: '#87CEEB',
  pink: '#E0399A',
  orange: '#F7941D',
  red: '#E0312B',
  yellow: '#F5D90A',
  green: '#1FA45A',
  darkblue: '#3A5BD9',
  railroad: '#2B2B2B',
  utility: '#B8C4CC'
};

export const GROUP_LABELS = {
  brown: 'Brown',
  lightblue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  darkblue: 'Dark blue',
  railroad: 'Subway stations',
  utility: 'Utilities'
};

export function spaceName(position) {
  return SPACES[position]?.name ?? `Space ${position}`;
}

// Color key for a property row from the server (railroads and utilities have no color_group of their own).
export function groupKey(property) {
  if (property.property_type === 'railroad') return 'railroad';
  if (property.property_type === 'utility') return 'utility';
  return property.color_group;
}

// ---- sets and space descriptions (used by the game screen) ---------------------------------------------

// Color sets in board order, streets first, then stations and utilities.
export const GROUP_ORDER = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility'];

// How many spaces each set has: { brown: 2, lightblue: 3, ..., railroad: 4, utility: 2 }
export const GROUP_SIZES = SPACES.reduce((sizes, space) => {
  const key = space.kind === 'property' ? space.group : ['railroad', 'utility'].includes(space.kind) ? space.kind : null;
  if (key) sizes[key] = (sizes[key] || 0) + 1;
  return sizes;
}, {});

export const DECK_LABELS = { chance: 'Opportunity', community: 'Community Fund' };

export const JAIL_FINE = 50;
export const MAX_JAIL_ATTEMPTS = 3;

const TAX_AMOUNTS = { 4: 200, 38: 100 };

// One sentence about what a non-purchasable space does.
export function describeSpace(position) {
  const space = SPACES[position];
  switch (space?.kind) {
    case 'go': return 'Collect your salary every time you land on or pass this space.';
    case 'community': return `Draw a ${DECK_LABELS.community} card.`;
    case 'chance': return `Draw an ${DECK_LABELS.chance} card.`;
    case 'tax': return `Pay $${TAX_AMOUNTS[position] ?? 100} to the bank.`;
    case 'jail': return `Just visiting, unless the NYPD sent you. Leave by rolling doubles, paying $${JAIL_FINE} or using a Get Out of Jail Free card.`;
    case 'free': return 'Nothing happens here. Take a breather.';
    case 'gotojail': return "Go directly to Rikers. Do not pass New Year's Eve, do not collect a salary.";
    default: return '';
  }
}
