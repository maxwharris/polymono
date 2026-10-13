import { useEffect, useId, useState } from 'react';
import { PLAYER_COLORS, playerColor } from '../../lib/colors';
import { seatOrder, turnName, upNextLine } from './turnOrder';
import './ui.css';

// Geometry on a 120 x 66 plate: hub at (60, 60), segments between r 33 and 49, rim at 56.
const CX = 60;
const CY = 60;
const R0 = 33;
const R1 = 49;
const GAP = 0.04; // radians between segments
const pt = (r, a) => `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;

// The six player colours in seat order: the emblem on the login page, when there are no players to show.
const EMBLEM = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'].map((key, i) => ({ id: `emblem-${i}`, player_color: key, turn_order: i + 1 }));

// 11 faint rays, alternating long and short (the Chrysler crown), drawn once.
const RAYS = Array.from({ length: 11 }, (_, i) => {
  const a = Math.PI + ((i + 1) * Math.PI) / 12;
  return `M${pt(9, a)} L${pt(i % 2 ? 29 : 22, a)}`;
}).join(' ');

function segmentPath(i, n) {
  const a0 = Math.PI + (i * Math.PI) / n + GAP;
  const a1 = Math.PI + ((i + 1) * Math.PI) / n - GAP;
  return `M${pt(R1, a0)} A${R1} ${R1} 0 0 1 ${pt(R1, a1)} L${pt(R0, a1)} A${R0} ${R0} 0 0 0 ${pt(R0, a0)} Z`;
}

// The brass "you" tick: a small pointer just inside the rim, aimed at your segment.
function youTickPath(i, n) {
  const a = Math.PI + ((i + 0.5) * Math.PI) / n;
  const w = 0.075;
  return `M${pt(49.6, a)} L${pt(55.3, a - w)} L${pt(55.3, a + w)} Z`;
}

/**
 * The turn dial: a brass Deco elevator floor indicator. One arc segment per player in seat order, the needle
 * on whoever is up, a brass tick on your own segment. It reinforces the text beside it ("jack's turn"), it is
 * never the only signal.
 *
 *   <TurnDial players={game.players} currentUserId={game.current_turn_user_id} myUserId={user.id} size={76} />
 *   <TurnDial size={176} sweep decorative />     the login emblem: six colours, needle sweeps in once
 *
 * players        game players ({ user_id, username, player_color, turn_order, is_bankrupt }); sorted by turn_order
 * currentUserId  whose turn it is (game.current_turn_user_id); null points the needle straight up
 * myUserId       the viewer's user id: draws the "you" tick and adds "You're up after …" to the accessible name
 * size           width in px (height is 0.55 of it). Phone 76, desktop 92, login 176
 * tint           'current' lights only the current segment (inactive ones in seam colour: legible at phone size),
 *                'all' shows every player's colour at 30%. Default: 'all' from 88px up, else 'current'
 * sweep          animate the needle in from the left once on mount
 * label          override the accessible name; decorative hides it from assistive tech instead
 */
export default function TurnDial({ players = [], currentUserId = null, myUserId = null, size = 76, tint, sweep = false, label, decorative = false, className = '' }) {
  const rawId = useId();
  const glowId = `dial-glow-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [settled, setSettled] = useState(!sweep);

  useEffect(() => {
    if (!sweep) return undefined;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [sweep]);

  const emblem = players.length === 0;
  const seats = emblem ? EMBLEM : seatOrder(players);
  const n = seats.length;
  const mode = tint ?? (size >= 88 || emblem ? 'all' : 'current');
  const currentIndex = emblem ? 3 : seats.findIndex(p => p.user_id === currentUserId);
  const myIndex = emblem ? -1 : seats.findIndex(p => p.user_id === myUserId && myUserId != null);

  // The needle is drawn pointing up; rotate it onto the current segment's centre.
  const target = currentIndex >= 0 ? ((currentIndex + 0.5) * 180) / n - 90 : 0;
  const angle = settled ? target : -90;

  const name = label ?? (emblem
    ? 'Polymono'
    : [turnName(players, currentUserId, myUserId), upNextLine(players, currentUserId, myUserId)].filter(Boolean).join('. ') || 'Turn order');
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name };

  return (
    <svg
      className={`ui-dial ui-dial--${mode}${className ? ` ${className}` : ''}`}
      width={size}
      height={Math.round((size * 66) / 120)}
      viewBox="0 0 120 66"
      focusable="false"
      {...a11y}
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path className="ui-dial__plate" d="M4 60 A56 56 0 0 1 116 60 Z" />
      <path className="ui-dial__rule" d="M8.5 60 A51.5 51.5 0 0 1 111.5 60" />
      <path className="ui-dial__rays" d={RAYS} />
      {seats.map((p, i) => {
        const on = i === currentIndex;
        const out = !!p.is_bankrupt;
        const color = emblem ? PLAYER_COLORS[p.player_color] : playerColor(p);
        return (
          <path
            key={p.id ?? p.user_id ?? i}
            className={`ui-dial__seg${on ? ' is-on' : ''}${out ? ' is-out' : ''}`}
            d={segmentPath(i, n)}
            style={{ '--pc': color }}
            filter={on && !out ? `url(#${glowId})` : undefined}
          />
        );
      })}
      {myIndex >= 0 && <path className="ui-dial__you" d={youTickPath(myIndex, n)} />}
      <g className="ui-dial__needle" style={{ transform: `rotate(${angle}deg)` }}>
        <polygon points="60,13 62.7,60 60,66.4 57.3,60" />
      </g>
      <circle className="ui-dial__hub" cx="60" cy="60" r="5.6" />
      <circle className="ui-dial__pin" cx="60" cy="60" r="1.8" />
      <path className="ui-dial__base" d="M2 60.6 H118" />
    </svg>
  );
}
