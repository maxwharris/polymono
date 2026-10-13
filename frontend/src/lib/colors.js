// Player colors, chosen to stay readable (3:1 or better) on the dark green UI.
export const PLAYER_COLORS = {
  red: '#FF6B6B',
  blue: '#4EA8DE',
  green: '#2EC4B6',
  yellow: '#FFD166',
  purple: '#C77DFF',
  orange: '#FF9F1C',
  gray: '#B0B8B4'
};

const ORDER = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

// The server assigns player_color on join; fall back to seat order for older rows.
export function playerColor(player) {
  if (!player) return PLAYER_COLORS.gray;
  return PLAYER_COLORS[player.player_color] || PLAYER_COLORS[ORDER[(player.turn_order - 1) % ORDER.length]] || PLAYER_COLORS.gray;
}

// Dark or light text for a background color ('#RRGGBB'), whichever reads better.
export function readableInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.33 ? '#111111' : '#FFFFFF';
}
