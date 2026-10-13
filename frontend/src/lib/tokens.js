// Player tokens: the six 3D models in public/tokens. Older accounts may still carry the original
// Monopoly names, which map onto the same models.
export const TOKENS = {
  taxi: { label: 'Taxi', emoji: '🚕' },
  pigeon: { label: 'Pigeon', emoji: '🐦' },
  rat: { label: 'Rat', emoji: '🐀' },
  subway: { label: 'Subway', emoji: '🚇' },
  bull: { label: 'Bull', emoji: '🐂' },
  empire: { label: 'Empire State', emoji: '🏙️' }
};

export const TOKEN_TYPES = Object.keys(TOKENS);

const LEGACY = { car: 'taxi', hat: 'pigeon', dog: 'rat', ship: 'subway', thimble: 'bull', shoe: 'empire' };

export function tokenKey(tokenType) {
  return TOKENS[tokenType] ? tokenType : LEGACY[tokenType] || 'taxi';
}

export function tokenEmoji(tokenType) {
  return TOKENS[tokenKey(tokenType)].emoji;
}

export function tokenLabel(tokenType) {
  return TOKENS[tokenKey(tokenType)].label;
}
