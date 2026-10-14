import { useLayoutEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { GROUP_LABELS, GROUP_SIZES, PROPERTY_COLORS, SPACES, describeSpace, groupKey } from '../../lib/board';
import { readableInk } from '../../lib/colors';
import { money } from '../../lib/format';
import { ownedCount, rentLadder, rentNowLabel, unmortgageCost } from '../../lib/rules';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { Houses, Swatch } from './bits';
import './deed.css';

function groupName(key) {
  const label = GROUP_LABELS[key] || '';
  return key === 'railroad' || key === 'utility' ? label : `${label} set`;
}

/** "Pink set, youngeun owns all 3" with one square per property in the set (filled = held by that owner). */
function SetLine({ property, owner, me, properties }) {
  const key = groupKey(property);
  const total = GROUP_SIZES[key] || 0;
  const inGroup = properties.filter(p => groupKey(p) === key).sort((a, b) => a.position_on_board - b.position_on_board);
  let text;
  let filled;
  if (owner) {
    const n = ownedCount(owner.id, key, properties);
    const who = me && owner.id === me.id ? 'you own' : `${owner.username} owns`;
    text = n === total ? `${groupName(key)}, ${who} all ${total}` : `${groupName(key)}, ${who} ${n} of ${total}`;
    filled = p => p.owner_id === owner.id;
  } else {
    const taken = inGroup.filter(p => p.owner_id != null).length;
    text = taken ? `${groupName(key)}, ${taken} of ${total} owned` : `${groupName(key)}, ${total} properties`;
    filled = p => p.owner_id != null;
  }
  return (
    <p className="deed__set">
      <span className="deed__squares" aria-hidden="true">
        {inGroup.map(p => <i key={p.id} className={filled(p) ? 'is-on' : undefined} />)}
      </span>
      {text}
    </p>
  );
}

/** The current-rent tab: a group-coloured index tab sticking out of the deed's left edge at the "Now" row. */
function useIndexTab(wrapRef, tabRef, deps) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const tab = tabRef.current;
    if (!wrap || !tab) return undefined;
    const place = () => {
      const row = wrap.querySelector('.deed__ladder > .is-now');
      if (!row) return;
      let y = 0;
      for (let n = row; n && n !== wrap; n = n.offsetParent) y += n.offsetTop;
      tab.style.top = `${y + 2}px`;
      tab.style.height = `${row.offsetHeight - 4}px`;
    };
    place();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(place);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The full title deed: band, set line, rent ladder, facts and the perforated owner stub. */
function FullDeed({ property, owner, me, properties, className }) {
  const wrapRef = useRef(null);
  const tabRef = useRef(null);
  const key = groupKey(property);
  const color = PROPERTY_COLORS[key] || '#888';
  const isStreet = property.property_type === 'property';
  const { rows, current } = rentLadder(property, properties);
  const rentNow = rentNowLabel(property);
  const mortgaged = !!property.is_mortgaged;
  useIndexTab(wrapRef, tabRef, [current, property.id, rows.length]);

  const facts = [
    { label: 'Price', value: money(property.purchase_price) },
    ...(isStreet ? [{ label: 'Houses', value: `${money(property.house_cost)} each` }] : []),
    { label: 'Mortgage value', value: money(property.mortgage_value) },
    { label: 'Unmortgage', value: money(unmortgageCost(property)) }
  ];

  return (
    <div ref={wrapRef} className={`deed-wrap ${className}`} style={{ '--g': color, '--g-ink': readableInk(color) }}>
      <article className={`deed${mortgaged ? ' is-mortgaged' : ''}`} aria-label={`${property.name}, title deed${mortgaged ? ', mortgaged' : ''}`}>
        <div className="deed__in">
          <header className="deed__band">
            <h2 className="deed__name">{property.name}</h2>
          </header>
          <SetLine property={property} owner={owner} me={me} properties={properties} />
          <ol className="deed__ladder" aria-label="Rent">
            {rows.map((row, i) => (
              <li key={row.label} className={i === current ? 'is-now' : undefined} aria-current={i === current ? 'true' : undefined}>
                <span className="deed__label">{row.label}</span>
                {i === current && <span className="ui-tag ui-tag--ink">Now</span>}
                <span className="deed__dots" aria-hidden="true" />
                <span className="ui-money">{row.value}</span>
              </li>
            ))}
          </ol>
          <dl className={`deed__facts${facts.length % 2 ? ' is-odd' : ''}`}>
            {facts.map(f => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd className="ui-money">{f.value}</dd>
              </div>
            ))}
          </dl>
          <footer className="deed__stub">
            {owner ? (
              <>
                <Medallion player={owner} size={36} />
                <span className="deed__owner">
                  <span className="deed__owned">Owned by</span>
                  <span className="deed__sign">{owner.username}{me && owner.id === me.id ? ' (you)' : ''}</span>
                  {isStreet && property.house_count > 0 && <Houses count={property.house_count} paper />}
                </span>
                <span className="deed__rent">
                  {mortgaged ? 'Mortgaged' : 'Rent now'}
                  <span className="ui-money">{mortgaged ? 'No rent' : rentNow}</span>
                </span>
              </>
            ) : (
              <>
                <span className="deed__bank" aria-hidden="true"><Icon name="bank" size={22} /></span>
                <span className="deed__owner">
                  <span className="deed__owned">For sale by the bank</span>
                  <span className="deed__sign deed__sign--bank">Unowned</span>
                </span>
                <span className="deed__rent">
                  Price
                  <span className="ui-money">{money(property.purchase_price)}</span>
                </span>
              </>
            )}
          </footer>
        </div>
        {mortgaged && <span className="deed__stamp" aria-hidden="true">Mortgaged</span>}
      </article>
      {current >= 0 && <span ref={tabRef} className="deed__tab" aria-hidden="true" />}
    </div>
  );
}

/** The small, tilted deed in the buy prompt: band, name and price. Also used by the buy flight. */
export function MiniDeed({ property, className = '', stamp = null, ...rest }) {
  const color = PROPERTY_COLORS[groupKey(property)] || '#888';
  return (
    <div className={`mini-deed ${className}`} style={{ '--g': color }} {...rest}>
      <div className="mini-deed__in">
        <span className="mini-deed__band" />
        <span className="mini-deed__name">{property.name}</span>
        <span className="mini-deed__price">
          <small>Price</small>
          <span className="ui-money">{money(property.purchase_price)}</span>
        </span>
      </div>
      {stamp}
    </div>
  );
}

const SPACE_ICONS = { go: 'sparkle', community: 'card', chance: 'question', tax: 'note', jail: 'bars', free: 'pin', gotojail: 'bars' };

/** A special space (Opportunity, Rikers, …) on the same paper, with the navy-and-brass band of its tile. */
export function SpaceCard({ position, titleId }) {
  const space = SPACES[position];
  if (!space) return null;
  return (
    <div className="deed-wrap deed-wrap--space">
      <article className="deed deed--space">
        <div className="deed__in">
          <header className="deed__band">
            <Icon name={SPACE_ICONS[space.kind] || 'board'} size={28} className="deed__space-icon" />
            <h2 id={titleId} className="deed__name">{space.name}</h2>
          </header>
          <p className="deed__text">{describeSpace(position)}</p>
        </div>
      </article>
    </div>
  );
}

/**
 * A property as a title deed. variant:
 *  - 'full': the paper deed (rent ladder with the current tier, facts, the owner's tear-off stub).
 *  - 'compact': the buy prompt's mini deed.
 *  - 'row': one line for lists (holdings, the drawer): swatch, name, drawn houses, rent now.
 */
export default function PropertyCard({ property, variant = 'full', className = '' }) {
  const { players, properties, myUserId } = useGameStore(useShallow(s => ({
    players: s.players,
    properties: s.properties,
    myUserId: s.isSpectator ? null : s.user?.id
  })));
  if (!property) return null;

  const color = PROPERTY_COLORS[groupKey(property)] || '#888';
  const owner = property.owner_id != null ? players.find(p => p.id === property.owner_id) : null;
  const me = myUserId != null ? players.find(p => p.user_id === myUserId) : null;
  const isStreet = property.property_type === 'property';

  if (variant === 'row') {
    const rentNow = rentNowLabel(property);
    return (
      <span className={`holding ${property.is_mortgaged ? 'is-mortgaged' : ''} ${className}`}>
        <Swatch color={color} />
        <span className="holding__name">{property.name}</span>
        {isStreet && property.house_count > 0 && <Houses count={property.house_count} />}
        {property.is_mortgaged
          ? <span className="ui-tag ui-tag--stop holding__end">Mortgaged</span>
          : rentNow && <span className="holding__end holding__rent">Rent <span className="ui-money">{rentNow}</span></span>}
      </span>
    );
  }

  if (variant === 'compact') return <MiniDeed property={property} className={className} />;

  return <FullDeed property={property} owner={owner} me={me} properties={properties} className={className} />;
}
