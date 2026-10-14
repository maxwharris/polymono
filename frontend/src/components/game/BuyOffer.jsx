import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GROUP_LABELS, GROUP_SIZES, PROPERTY_COLORS, groupKey } from '../../lib/board';
import { groupStops, joinNames, keyRents, ownedCount } from '../../lib/rules';
import { prefersReducedMotion } from '../../hooks/useMediaQuery';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { MiniDeed } from './PropertyCard';

function setNoun(key, total) {
  if (key === 'railroad') return `${total} stations`;
  if (key === 'utility') return 'utilities';
  return `${total} ${GROUP_LABELS[key].toLowerCase()}`;
}

/** The sentence under the strip map: brass when it is about your own set. */
function setSentence(property, me, stops, properties) {
  const key = groupKey(property);
  const total = GROUP_SIZES[key] || stops.length;
  const mine = me ? ownedCount(me.id, key, properties) : 0;
  if (me && mine + 1 === total) {
    const what = key === 'railroad' ? 'every station' : key === 'utility' ? 'both utilities' : `your ${GROUP_LABELS[key].toLowerCase()} set`;
    return { brass: true, text: key === 'railroad' || key === 'utility' ? `Gives you ${what}` : `Completes ${what}` };
  }
  if (me && mine > 0) return { brass: true, text: `You'd own ${mine + 1} of ${setNoun(key, total)}` };
  const others = stops.filter(s => s.owner && !s.here);
  if (others.length) {
    const names = [...new Set(others.map(s => s.owner.username))];
    const verb = names.length === 1 ? 'owns' : 'own';
    return { brass: false, text: `${joinNames(names)} ${verb} ${others.length} of ${setNoun(key, total)}` };
  }
  return { brass: false, text: `The first of ${setNoun(key, total)}` };
}

/**
 * The colour group as a strip map (graft A2): a rail in the group colour, one stop per property in board
 * order. Owned stops carry the owner's medallion (a circle is a person); the bank's are small squares (a
 * square is a place); this property is the brass "you are here" stop.
 */
function StripMap({ property, stops, me }) {
  const color = PROPERTY_COLORS[groupKey(property)];
  const label = stops.map(s => {
    if (s.here) return `${s.property.name}, this one`;
    if (s.owner) return `${s.property.name}, ${me && s.owner.id === me.id ? 'yours' : `${s.owner.username}'s`}`;
    return `${s.property.name}, the bank's`;
  }).join('; ');
  return (
    <div className="strip" style={{ '--g': color }} role="img" aria-label={`${GROUP_LABELS[groupKey(property)]}: ${label}`}>
      <span className="strip__rail" aria-hidden="true" />
      {stops.map(s => (
        <span key={s.property.id} className={`strip__stop${s.here ? ' is-here' : ''}`} title={s.property.name} aria-hidden="true">
          {s.here ? (
            <span className="strip__here"><Icon name="pin" size={14} strokeWidth={2} /></span>
          ) : s.owner ? (
            <Medallion player={s.owner} size={22} />
          ) : (
            <span className="strip__bank" />
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * The buy prompt's body: the mini deed (dealt up at −2°), the three rents that matter, the strip map and the
 * set sentence. `stamping` lays your medallion on the deed (the Buy motion).
 */
export default function BuyOffer({ property, me, players, properties, stamping = false, deedRef }) {
  const stops = groupStops(property, properties, players);
  const sentence = setSentence(property, me, stops, properties);
  return (
    <div className="offer">
      <div className="offer__deed" ref={deedRef}>
        <MiniDeed property={property} stamp={stamping && me ? <Medallion player={me} size={46} className="offer__stamp" /> : null} />
      </div>
      <div className="offer__side">
        <dl className="offer__facts">
          {keyRents(property).map(f => (
            <div key={f.label} className="offer__fact">
              <dt>{f.label}</dt>
              <dd className="ui-money">{f.value}</dd>
            </div>
          ))}
        </dl>
        <StripMap property={property} stops={stops} me={me} />
        <p className={`offer__set${sentence.brass ? ' is-brass' : ''}`}>{sentence.text}</p>
      </div>
    </div>
  );
}

/**
 * After a purchase: the stamped deed slides from where it was toward "Mine" (the tab, the holdings or the
 * My properties button, whichever is on screen) and that target bumps once. Skipped under reduced motion.
 */
export function DeedFlight({ flight, onDone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const targets = [...document.querySelectorAll('[data-flight-target]')]
      .filter(t => t.getClientRects().length > 0 && getComputedStyle(t).visibility !== 'hidden')
      .sort((a, b) => Number(a.dataset.flightTarget) - Number(b.dataset.flightTarget));
    const target = targets[0];
    if (!el || !target || prefersReducedMotion()) {
      onDone();
      return undefined;
    }
    const from = flight.rect;
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(0, -10px) scale(1.02)', opacity: 1, offset: 0.2 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.22)`, opacity: 0.15 }
      ],
      { duration: 620, easing: 'cubic-bezier(.45, 0, .7, .2)', fill: 'forwards' }
    );
    anim.onfinish = () => {
      target.animate?.(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
        { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' }
      );
      onDone();
    };
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { rect, property, me } = flight;
  return createPortal(
    <div ref={ref} className="deed-flight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} aria-hidden="true">
      <MiniDeed property={property} stamp={me ? <Medallion player={me} size={46} className="offer__stamp is-set" /> : null} />
    </div>,
    document.body
  );
}
