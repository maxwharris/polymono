import { playerColor } from '../../lib/colors';
import { TOKEN_GLYPH_VIEWBOX, tokenGlyph, tokenLabel } from '../../lib/tokens';
import Icon from './Icon';
import './ui.css';

/**
 * A token's flat silhouette (lib/tokens.js), one colour (currentColor), cut-outs are real holes.
 *
 *   <TokenGlyph token="taxi" size={18} />           decorative
 *   <TokenGlyph token={p.token_type} label="Taxi" /> role="img"
 */
export function TokenGlyph({ token, size = '1em', label, className = '' }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg className={`ui-glyph${className ? ` ${className}` : ''}`} width={size} height={size} viewBox={TOKEN_GLYPH_VIEWBOX} focusable="false" {...a11y}>
      <path d={tokenGlyph(token)} fillRule="evenodd" />
    </svg>
  );
}

/**
 * A player as a coin: a lacquer medallion ringed in their colour, with their token's glyph. Circles are
 * always people (swatches and bars are places). Sizes from the design: 22 feed, 28–30 chips, 36 top bar and
 * toasts, 40–44 rows and pickers, 48 desktop panel.
 *
 *   <Medallion player={p} />                         colour, token and bankrupt state from a game player
 *   <Medallion player={p} size={42} online={p.online} current />
 *   <Medallion token="bull" color="#B78CFF" />       without a player object
 *   <Medallion icon="eye" />                         a spectator (no token)
 *   <Medallion player={p} label="jack, Pigeon" />    meaningful on its own (default: aria-hidden)
 *
 * `current` adds the outer brass ring (whose turn it is); `out` (default: player.is_bankrupt) turns it slate.
 * `online` true/false shows the presence dot; leave it undefined to show none.
 */
export default function Medallion({ player, token, color, icon, size = 36, current = false, out, online, label, className = '' }) {
  const isOut = out ?? !!player?.is_bankrupt;
  const ring = color ?? (player ? playerColor(player) : 'var(--slate)');
  const tokenType = token ?? player?.token_type;
  const classes = ['ui-med', size < 28 && 'ui-med--sm', current && 'is-current', isOut && 'is-out', className].filter(Boolean).join(' ');
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span className={classes} style={{ '--pc': ring, '--med-s': `${size}px` }} title={label ? undefined : tokenType ? tokenLabel(tokenType) : undefined} {...a11y}>
      {icon ? <Icon name={icon} className="ui-med__icon" /> : <TokenGlyph token={tokenType} className="ui-med__glyph" />}
      {online !== undefined && <span className={`ui-med__dot${online ? ' is-on' : ''}`} />}
    </span>
  );
}
