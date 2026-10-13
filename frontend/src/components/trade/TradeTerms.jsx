import { tokenEmoji } from '../../lib/tokens';
import { playerColor } from '../../lib/colors';
import { money } from '../../lib/format';
import { isEmptySide, jailCardText, propertyColor } from './tradeUtils';
import s from './Trade.module.css';

export function PlayerTag({ player, fallbackName }) {
  const name = player?.username || fallbackName || 'Someone';
  return (
    <span className={s.playerTag}>
      <span aria-hidden="true">{player ? tokenEmoji(player.token_type) : '👤'}</span>
      <span className={s.playerTagName} style={{ color: playerColor(player) }}>{name}</span>
    </span>
  );
}

export function Swatch({ property }) {
  return <span className={s.swatch} style={{ '--swatch': propertyColor(property) }} aria-hidden="true" />;
}

export function PropertyChip({ property }) {
  return (
    <span className={s.chip}>
      <Swatch property={property} />
      <span>{property?.name || 'Unknown property'}</span>
      {property?.is_mortgaged && <span className={s.chipNote}>mortgaged</span>}
    </span>
  );
}

// One side of a trade as color chips: properties, then cash, then jail cards.
export function TermsList({ side, byId, emptyText = 'Nothing' }) {
  if (isEmptySide(side)) return <p className={s.nothing}>{emptyText}</p>;
  return (
    <ul className={s.terms}>
      {side.properties.map(id => (
        <li key={id}><PropertyChip property={byId.get(id)} /></li>
      ))}
      {side.money > 0 && (
        <li><span className={`${s.chip} ${s.cashChip}`}>{money(side.money)}</span></li>
      )}
      {side.jailCards > 0 && (
        <li><span className={`${s.chip} ${s.cardChip}`}>{jailCardText(side.jailCards)}</span></li>
      )}
    </ul>
  );
}
