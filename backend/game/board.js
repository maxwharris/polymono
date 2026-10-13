/**
 * Fixed board facts. Purchasable spaces live in the properties table (seeded from data/properties.js).
 */

const BOARD_SIZE = 40;
const JAIL_POSITION = 10;
const GO_TO_JAIL_POSITION = 30;
const JAIL_FINE = 50;
const MAX_JAIL_ATTEMPTS = 3;
const MAX_PLAYERS = 6;
const HOUSE_SUPPLY = 32;
const HOTEL_SUPPLY = 12;
const RAILROAD_RENT = [25, 50, 100, 200];
const RAILROADS = [5, 15, 25, 35];
const UTILITIES = [12, 28];

const SPECIAL_SPACES = {
  0: { type: 'GO', name: "New Year's Eve" },
  2: { type: 'COMMUNITY_CHEST', name: 'Community Fund' },
  4: { type: 'TAX', name: 'City Income Tax', amount: 200, kind: 'income' },
  7: { type: 'CHANCE', name: 'Opportunity' },
  10: { type: 'JAIL', name: 'Rikers' },
  17: { type: 'COMMUNITY_CHEST', name: 'Community Fund' },
  20: { type: 'FREE_PARKING', name: 'Lost and Found' },
  22: { type: 'CHANCE', name: 'Opportunity' },
  30: { type: 'GO_TO_JAIL', name: 'Arrested by NYPD' },
  33: { type: 'COMMUNITY_CHEST', name: 'Community Fund' },
  36: { type: 'CHANCE', name: 'Opportunity' },
  38: { type: 'TAX', name: 'Penthouse Luxury Tax', amount: 100, kind: 'luxury' }
};

const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const TOKEN_TYPES = ['taxi', 'pigeon', 'rat', 'subway', 'bull', 'empire'];

const DEFAULT_SETTINGS = { starting_money: 1500, go_salary: 200, turn_hours: 24 };

// Forward distance from one space to another (0 means a full lap).
function stepsForwardTo(from, to) {
  const d = (to - from + BOARD_SIZE) % BOARD_SIZE;
  return d === 0 ? BOARD_SIZE : d;
}

function nextOf(list, from) {
  return list.find(p => p > from) ?? list[0];
}

module.exports = {
  BOARD_SIZE,
  JAIL_POSITION,
  GO_TO_JAIL_POSITION,
  JAIL_FINE,
  MAX_JAIL_ATTEMPTS,
  MAX_PLAYERS,
  HOUSE_SUPPLY,
  HOTEL_SUPPLY,
  RAILROAD_RENT,
  RAILROADS,
  UTILITIES,
  SPECIAL_SPACES,
  PLAYER_COLORS,
  TOKEN_TYPES,
  DEFAULT_SETTINGS,
  stepsForwardTo,
  nextOf
};
