// Small presentational pieces shared by the game screen.
import { playerColor } from '../../lib/colors';
import { tokenEmoji, tokenLabel } from '../../lib/tokens';
import useCountdown from '../../hooks/useCountdown';

export function Spinner({ label }) {
  return <span className="g-spinner" role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function Die({ value }) {
  const on = PIPS[value] || [];
  return (
    <span className="g-die" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={on.includes(i) ? 'is-on' : undefined} />)}
    </span>
  );
}

export function Dice({ roll, className = '' }) {
  if (!roll) return null;
  return (
    <span className={`g-dice ${className}`} role="img" aria-label={`Rolled ${roll.die1} and ${roll.die2}${roll.isDoubles ? ', doubles' : ''}`}>
      <Die value={roll.die1} />
      <Die value={roll.die2} />
    </span>
  );
}

// Four house pips and a hotel pip; house_count 5 = hotel.
export function HousePips({ count = 0 }) {
  const hotel = count >= 5;
  const label = hotel ? 'Hotel' : `${count} house${count === 1 ? '' : 's'}`;
  return (
    <span className="g-pips" role="img" aria-label={label}>
      {[1, 2, 3, 4].map(n => <span key={n} className={`g-pip${!hotel && count >= n ? ' is-on' : ''}`} />)}
      <span className={`g-pip g-pip--hotel${hotel ? ' is-on' : ''}`} />
    </span>
  );
}

export function TokenBadge({ player, size = 'md', online }) {
  if (!player) return null;
  return (
    <span className={`g-token g-token--${size}`} style={{ '--pc': playerColor(player) }} title={tokenLabel(player.token_type)}>
      <span aria-hidden="true">{tokenEmoji(player.token_type)}</span>
      {online !== undefined && (
        <span className={`g-online${online ? ' is-on' : ''}`}>
          <span className="sr-only">{online ? ' online' : ' offline'}</span>
        </span>
      )}
    </span>
  );
}

export function PlayerChip({ player, you = false }) {
  if (!player) return <span className="g-chip g-chip--bank">Bank</span>;
  return (
    <span className="g-chip" style={{ '--pc': playerColor(player) }}>
      <span className="g-chip-dot" aria-hidden="true" />
      <span aria-hidden="true">{tokenEmoji(player.token_type)}</span>
      {player.username}{you ? ' (you)' : ''}
    </span>
  );
}

// "19h 12m left", amber under 4h, red under 1h. Renders nothing without a deadline.
export function Countdown({ deadline, suffix = ' left', className = '' }) {
  const { label, tone } = useCountdown(deadline);
  if (!label) return null;
  return <span className={`g-countdown is-${tone} ${className}`}>{label === 'overdue' ? 'overdue' : `${label}${suffix}`}</span>;
}
