import { ICONS, ICON_ALIASES } from './icons';
import './ui.css';

/**
 * A line icon from the Midnight Deco set (icons.jsx): 24px grid, 1.75 stroke, currentColor.
 *
 *   <Icon name="dice" />                      decorative (aria-hidden), 24px
 *   <Icon name="close" size={20} />
 *   <Icon name="bell" label="Alerts" />       meaningful on its own: role="img" with that name
 *
 * `name` may be a drawing name (ICON_NAMES) or a use alias (ICON_ALIASES: money, jail, mortgage, back, …).
 * An unknown name renders nothing.
 */
export default function Icon({ name, size = 24, strokeWidth = 1.75, label, className = '', ...rest }) {
  const shape = ICONS[name] ?? ICONS[ICON_ALIASES[name]];
  if (!shape) return null;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      className={`ui-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
      {...rest}
    >
      {shape}
    </svg>
  );
}
