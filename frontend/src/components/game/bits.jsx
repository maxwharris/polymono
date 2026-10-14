// Small presentational pieces shared by the game screen (Midnight Deco). Classes come from ui/ui.css (ui-*)
// and game.css.
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { money } from '../../lib/format';
import { splitMoney } from '../../lib/events';
import useCountdown from '../../hooks/useCountdown';
import { prefersReducedMotion } from '../../hooks/useMediaQuery';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';

export function Spinner({ label }) {
  return <span className="ui-spinner" role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

/** Paper dice for a roll ({ die1, die2, isDoubles }). */
export function Dice({ roll, className = '' }) {
  if (!roll?.die1 || !roll?.die2) return null;
  return (
    <span className={`ui-dice ${className}`} role="img" aria-label={`Rolled ${roll.die1} and ${roll.die2}${roll.isDoubles ? ', doubles' : ''}`}>
      {[roll.die1, roll.die2].map((v, i) => (
        <span key={i} className="ui-die" data-value={v}>
          {Array.from({ length: 9 }, (_, n) => <i key={n} />)}
        </span>
      ))}
    </span>
  );
}

/** Drawn buildings: four houses, then a wider hotel (house_count 5). Filled when built, outlined when not. */
export function Houses({ count = 0, paper = false, className = '' }) {
  const hotel = count >= 5;
  const label = hotel ? 'A hotel' : count ? `${count} house${count === 1 ? '' : 's'}` : 'No buildings';
  return (
    <span className={`houses${paper ? ' houses--paper' : ''} ${className}`} role="img" aria-label={label}>
      {[0, 1, 2, 3].map(i => (
        <svg key={i} className={`houses__house${!hotel && i < count ? ' is-on' : ''}`} width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="M1 6.2 6 1.6l5 4.6V11H1z" />
        </svg>
      ))}
      <svg className={`houses__hotel${hotel ? ' is-on' : ''}`} width="19" height="13" viewBox="0 0 18 12" aria-hidden="true" focusable="false">
        <path d="M1 4.5 9 1l8 3.5V11H1z" />
      </svg>
    </span>
  );
}

/** A colour-group swatch (always beside the group or property name). */
export function Swatch({ color, large = false }) {
  return <span className={`ui-swatch${large ? ' ui-swatch--lg' : ''}`} style={{ '--g': color }} aria-hidden="true" />;
}

/** A player as a chip: medallion 28 and the name. */
export function PlayerChip({ player, you = false }) {
  if (!player) return <span className="ui-chip ui-chip--bank"><Icon name="bank" size={18} />Bank</span>;
  return (
    <span className="ui-chip">
      <Medallion player={player} size={28} />
      {player.username}
      {you && <span className="ui-tag">you</span>}
    </span>
  );
}

/** "21h 40m left": slate, brass under 3h, stop-red under 30m. Never blinks. Nothing without a deadline. */
export function Countdown({ deadline, suffix = ' left', className = '', icon = true }) {
  const { label, tone } = useCountdown(deadline);
  if (!label) return null;
  const cls = ['ui-countdown', tone === 'soon' && 'is-soon', tone === 'urgent' && 'is-urgent', className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {icon && <Icon name="clock" size={14} />}
      {label === 'overdue' ? 'Time is up' : `${label}${suffix}`}
    </span>
  );
}

/** A server sentence with its dollar amounts set as money (Jost 600, tabular). */
export function MoneyText({ text }) {
  return splitMoney(text).map((part, i) => (part.money ? <span key={i} className="ui-money">{part.money}</span> : part.text));
}

function themeColor(name, fallback) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

/**
 * An amount that rolls to its new value (tabular figures keep the width fixed), with a brief brass flash for
 * money in and a stop-red one for money out. `hold` keeps showing the old value (the board has not shown the
 * move that changed it yet). `delta` floats a single "+$200" / "−$200" beside it. Reduced motion: it swaps.
 */
export function RollingMoney({ value, hold = false, delta = false, className = '', label }) {
  const amount = Number(value) || 0;
  const [settled, setSettled] = useState(amount);
  const [change, setChange] = useState(null);
  if (!hold && amount !== settled) {
    setSettled(amount);
    setChange(c => ({ id: (c?.id ?? 0) + 1, amount: amount - settled }));
  }

  const numberRef = useRef(null);
  const fromRef = useRef(amount);
  useLayoutEffect(() => {
    const el = numberRef.current;
    const start = fromRef.current;
    fromRef.current = settled;
    if (!el || start === settled || prefersReducedMotion()) return undefined;
    const up = settled > start;
    el.animate?.(
      [{ color: themeColor(up ? '--brass-300' : '--stop', up ? '#EBD3A0' : '#FF7A6B') }, { color: getComputedStyle(el).color }],
      { duration: 600, easing: 'ease-out' }
    );
    const t0 = performance.now();
    const duration = 400;
    let frame = 0;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = money(Math.round(start + (settled - start) * eased));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = money(start);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = money(settled);
    };
  }, [settled]);

  return (
    <span className={`rolling-money ${className}`}>
      <span ref={numberRef} className="ui-money" aria-label={label ? `${label}: ${money(settled)}` : undefined}>{money(settled)}</span>
      {delta && change && change.amount !== 0 && (
        <span key={change.id} className={`money-delta ${change.amount > 0 ? 'is-in' : 'is-out'}`} aria-hidden="true">
          {change.amount > 0 ? '+' : '−'}{money(Math.abs(change.amount))}
        </span>
      )}
    </span>
  );
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}

// The first option whose headline and sub line both fit `room`; failing that the first whose headline fits
// (an ellipsis in the sub line beats a shorter headline); failing that the last.
function pickFit(room, rows) {
  const fits = w => w <= room + 0.01;
  let headOnly = -1;
  for (let i = 0; i < rows.length; i++) {
    if (!fits(rows[i].head)) continue;
    if (fits(rows[i].sub)) return i;
    if (headOnly < 0) headOnly = i;
  }
  return headOnly >= 0 ? headOnly : rows.length - 1;
}

const widthOf = el => (el ? el.getBoundingClientRect().width : 0);

/**
 * A turn-panel headline that stays on one line (must-fix #1). `options` are tried in order,
 * [{ key, headline, sub }]: the first whose headline and sub line both fit is shown, so "You landed on One
 * World Trade Center" becomes "One World Trade Center" with "You landed here" in the sub line.
 *
 * Every option is laid out at its natural width in a hidden copy (.tp__probes), and the choice is made again
 * from the longest option whenever the room, the fonts or the texts change: a wider screen or a rotation
 * brings the long headline back. The measurements never depend on the option on show (the headline's width
 * comes from the grid, not its text), so it cannot oscillate, and it settles before paint.
 */
export function FitHeadline({ options, id, as = 'h2' }) {
  const Tag = as;
  const [picked, setPicked] = useState(0);
  const index = Math.min(picked, options.length - 1);
  const ref = useRef(null);
  const probesRef = useRef(null);
  // New texts get new probes to observe; the probes' own resizes (fonts, the countdown) re-fit by themselves.
  const textKey = options.map(o => `${o.key}:${o.sub ? 's' : ''}:${textOf(o.headline)}`).join('|');

  useLayoutEffect(() => {
    const el = ref.current;
    const box = probesRef.current;
    if (!el || !box) return undefined;
    const rows = [...box.children].map(row => ({ head: row.children[0], sub: row.children[1] }));
    const refit = () => {
      const room = widthOf(el);
      if (!room) return; // hidden (display: none): keep the last choice
      setPicked(pickFit(room, rows.map(r => ({ head: widthOf(r.head), sub: widthOf(r.sub) }))));
    };
    refit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // Observations arrive after layout and before paint; flushSync renders the new choice in that same frame.
    const observer = new ResizeObserver(() => flushSync(refit));
    observer.observe(el);
    for (const r of rows) {
      observer.observe(r.head);
      if (r.sub) observer.observe(r.sub);
    }
    return () => observer.disconnect();
  }, [textKey]);

  const option = options[index];
  return (
    <div className="tp__titles">
      <Tag ref={ref} id={id} className="ui-headline tp__headline" aria-live="polite">{option.headline}</Tag>
      {option.sub && <p className="tp__sub">{option.sub}</p>}
      {options.length > 1 && (
        <div ref={probesRef} className="tp__probes" aria-hidden="true">
          {options.map((o, i) => (
            <div key={`${o.key}-${i}`}>
              <span className="ui-headline tp__headline">{o.headline}</span>
              {o.sub && <span className="tp__sub">{o.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
