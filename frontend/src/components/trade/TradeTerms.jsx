import { Fragment } from 'react';
import { GROUP_LABELS } from '../../lib/board';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { groupName, isEmptySide, jailCardText, propertyColor } from './tradeUtils';
import s from './Trade.module.css';

/** A player in a line of text: a 22px medallion and the name. */
export function PlayerTag({ player, fallbackName }) {
  const name = player?.username || fallbackName || 'Someone';
  return (
    <span className={s.playerTag}>
      {player ? <Medallion player={player} size={22} /> : <Medallion icon="user" size={22} />}
      <span className={s.playerTagName}>{name}</span>
    </span>
  );
}

/** A colour-group swatch (always beside the property's name), with the light inner ring. */
export function Swatch({ property }) {
  return <span className="ui-swatch" style={{ '--g': propertyColor(property) }} aria-hidden="true" />;
}

// "A", "A and B", "A, B and C"
function joined(items) {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 && (i === items.length - 1 ? ' and ' : ', ')}
      {item}
    </Fragment>
  ));
}

function sideItems(side, byId) {
  const items = side.properties.map(id => <b key={`p${id}`}>{byId.get(id)?.name || `Property ${id}`}</b>);
  if (side.money > 0) items.push(<b key="m" className="ui-money">{money(side.money)}</b>);
  if (side.jailCards > 0) {
    items.push(<b key="j">{side.jailCards === 1 ? 'a Get Out of Jail Free card' : jailCardText(side.jailCards)}</b>);
  }
  return items;
}

function setsText(groups) {
  const names = groups.map(g => (GROUP_LABELS[g] || g).toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `completes your ${list} set${names.length > 1 ? 's' : ''}`;
}

/**
 * The deal as one plain sentence from my side, the accessible text of every offer:
 * "You give Penn Station, Con Edison and $250. You get Theater District and Bryant Park, which completes
 * your red set." The set note (brass) only appears when it is true.
 */
export function DealSentence({ give, get, byId, completes = [], past = false, className = '' }) {
  const giveItems = sideItems(give, byId);
  const getItems = sideItems(get, byId);
  return (
    <p className={`${s.sentence} ${className}`}>
      {past ? 'You gave ' : 'You give '}
      {giveItems.length ? joined(giveItems) : 'nothing'}
      {'. '}
      {past ? 'You got ' : 'You get '}
      {getItems.length ? joined(getItems) : 'nothing'}
      {completes.length > 0 ? <>, which <em>{setsText(completes)}</em>.</> : '.'}
    </p>
  );
}

function SlipSide({ title, side, byId }) {
  return (
    <div className={s.slipSide}>
      <p className={s.slipLabel}>{title}</p>
      {isEmptySide(side) ? (
        <p className={s.slipNothing}>Nothing</p>
      ) : (
        <ul className={s.slipChips}>
          {side.properties.map(id => {
            const property = byId.get(id);
            return (
              <li key={id} className={s.deedChip} style={{ '--g': propertyColor(property) }}>
                <span className={s.deedName}>{property?.name || `Property ${id}`}</span>
                <span className={property?.is_mortgaged ? s.deedMortgaged : s.deedGroup}>
                  {property?.is_mortgaged ? 'Mortgaged' : groupName(property)}
                </span>
              </li>
            );
          })}
          {side.money > 0 && (
            <li className={s.noteChip}>
              <Icon name="note" size={18} />
              <span className="ui-money">{money(side.money)}</span>
            </li>
          )}
          {side.jailCards > 0 && (
            <li className={s.cardChip}>
              <Icon name="card" size={18} />
              <span>{side.jailCards === 1 ? 'Free card' : `${side.jailCards} free cards`}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The paper "offer slip": both sides as mini-deed chips (a band in the group colour, the name, the group)
 * and banknote chips for cash. It is a picture of the deal; the DealSentence under it is the text, so the
 * slip is hidden from assistive tech.
 */
export function OfferSlip({ give, get, byId }) {
  return (
    <div className={s.slip} aria-hidden="true">
      <SlipSide title="You give" side={give} byId={byId} />
      <span className={s.slipSwap}><Icon name="trade" size={18} /></span>
      <SlipSide title="You get" side={get} byId={byId} />
    </div>
  );
}

// Kept for callers that list terms as chips (none in the trade window any more).
export function PropertyChip({ property }) {
  return (
    <span className={s.chip}>
      <Swatch property={property} />
      <span>{property?.name || 'Unknown property'}</span>
      {property?.is_mortgaged && <span className={s.chipNote}>mortgaged</span>}
    </span>
  );
}

export function TermsList({ side, byId, emptyText = 'Nothing' }) {
  if (isEmptySide(side)) return <p className={s.nothing}>{emptyText}</p>;
  return (
    <ul className={s.terms}>
      {side.properties.map(id => (
        <li key={id}><PropertyChip property={byId.get(id)} /></li>
      ))}
      {side.money > 0 && (
        <li><span className={`${s.chip} ui-money`}>{money(side.money)}</span></li>
      )}
      {side.jailCards > 0 && (
        <li><span className={s.chip}>{jailCardText(side.jailCards)}</span></li>
      )}
    </ul>
  );
}
