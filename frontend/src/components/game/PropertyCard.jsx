import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { GROUP_LABELS, GROUP_SIZES, PROPERTY_COLORS, groupKey } from '../../lib/board';
import { readableInk } from '../../lib/colors';
import { money } from '../../lib/format';
import { ownedCount, rentLadder, rentNowLabel, unmortgageCost } from '../../lib/rules';
import { HousePips, PlayerChip } from './bits';

function Stamp() {
  return <span className="pc-stamp" aria-label="Mortgaged">Mortgaged</span>;
}

function setLine(property, owner, me, properties) {
  const key = groupKey(property);
  const holder = owner || me;
  if (!holder) return null;
  const n = ownedCount(holder.id, key, properties);
  const who = holder === me ? 'You own' : `${holder.username} owns`;
  return `${who} ${n} of ${GROUP_SIZES[key]} ${GROUP_LABELS[key].toLowerCase()}`;
}

/**
 * A property as a title deed. variant:
 *  - 'full': rent ladder with the current tier highlighted, building costs, mortgage values, owner.
 *  - 'compact': the buy prompt: name, price, the key rents and how much of the set you'd have.
 *  - 'row': one line for lists (holdings, the drawer).
 */
export default function PropertyCard({ property, variant = 'full', className = '' }) {
  const { players, properties, myUserId } = useGameStore(useShallow(s => ({
    players: s.players,
    properties: s.properties,
    myUserId: s.isSpectator ? null : s.user?.id
  })));
  if (!property) return null;

  const key = groupKey(property);
  const color = PROPERTY_COLORS[key] || '#888';
  const owner = property.owner_id != null ? players.find(p => p.id === property.owner_id) : null;
  const me = myUserId != null ? players.find(p => p.user_id === myUserId) : null;
  const isStreet = property.property_type === 'property';
  const style = { '--band': color, '--band-ink': readableInk(color) };
  const rentNow = rentNowLabel(property);

  if (variant === 'row') {
    return (
      <div className={`pc pc--row ${property.is_mortgaged ? 'is-mortgaged' : ''} ${className}`} style={style}>
        <span className="pc-swatch" aria-hidden="true" />
        <span className="pc-row-name">{property.name}</span>
        {isStreet && property.house_count > 0 && <HousePips count={property.house_count} />}
        {property.is_mortgaged
          ? <span className="pc-badge">M</span>
          : rentNow && <span className="pc-row-rent money">{rentNow}</span>}
      </div>
    );
  }

  const { rows, current } = rentLadder(property, properties);

  if (variant === 'compact') {
    const values = property.rent_values || [];
    let rentSummary;
    if (isStreet) rentSummary = `Rent ${money(values[0])} · full set ${money(values[1])} · hotel ${money(values[6])}`;
    else if (property.property_type === 'railroad') rentSummary = `Rent ${money(values[0])} to ${money(values[values.length - 1])} by stations owned`;
    else rentSummary = `Rent ${values[0] ?? 4}× or ${values[1] ?? 10}× the dice`;
    const progress = setLine(property, owner, me, properties);
    return (
      <article className={`pc pc--compact ${className}`} style={style} aria-label={property.name}>
        <header className="pc-band">
          <span className="pc-kind">{GROUP_LABELS[key]}</span>
          <h3 className="pc-name">{property.name}</h3>
        </header>
        <div className="pc-body">
          <p className="pc-price">Price <strong className="money">{money(property.purchase_price)}</strong></p>
          <p className="pc-summary">{rentSummary}</p>
          {progress && <p className="pc-set">{progress}</p>}
        </div>
        {property.is_mortgaged && <Stamp />}
      </article>
    );
  }

  return (
    <article className={`pc pc--full ${className}`} style={style} aria-label={property.name}>
      <header className="pc-band">
        <span className="pc-kind">{GROUP_LABELS[key]}</span>
        <h3 className="pc-name">{property.name}</h3>
      </header>
      <div className="pc-body">
        <p className="pc-price">Price <strong className="money">{money(property.purchase_price)}</strong></p>
        <table className="pc-ladder">
          <caption className="sr-only">Rent</caption>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i === current ? 'is-current' : undefined} aria-current={i === current ? 'true' : undefined}>
                <th scope="row">{row.label}</th>
                <td className="money">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="pc-facts">
          {isStreet && (
            <>
              <div><dt>Houses</dt><dd className="money">{money(property.house_cost)} each</dd></div>
              <div><dt>Hotel</dt><dd className="money">{money(property.house_cost)} + 4 houses</dd></div>
            </>
          )}
          <div><dt>Mortgage value</dt><dd className="money">{money(property.mortgage_value)}</dd></div>
          <div><dt>Unmortgage</dt><dd className="money">{money(unmortgageCost(property))}</dd></div>
        </dl>
        <footer className="pc-owner">
          {owner ? (
            <>
              <PlayerChip player={owner} you={owner.user_id === myUserId} />
              {isStreet && property.house_count > 0 && <HousePips count={property.house_count} />}
              {rentNow && <span className="pc-now">Rent now <strong className="money">{rentNow}</strong></span>}
            </>
          ) : (
            <span className="pc-forsale">For sale by the bank</span>
          )}
        </footer>
      </div>
      {property.is_mortgaged && <Stamp />}
    </article>
  );
}
