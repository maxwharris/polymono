import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import { Houses, Spinner } from './bits';

/**
 * Build / sell / mortgage / unmortgage for one of my properties, from the server's `management`
 * (null = allowed, string = why not). A blocked control keeps its blocked look but stays tappable and explains
 * itself inline. `showBuildReason` prints the build reason up front (used once the player owns the whole set).
 */
export default function ManageControls({ property, showBuildReason = false }) {
  const { act, pendingAction } = useGameStore(useShallow(s => ({ act: s.act, pendingAction: s.pendingAction })));
  const [explain, setExplain] = useState(null);
  const m = property?.management;
  if (!m) return null;

  const isStreet = property.property_type === 'property';
  const busy = pendingAction != null && pendingAction.endsWith(`:${property.id}`);
  const pendingRoute = busy ? pendingAction.split(':')[0] : null;

  function run(route, reason) {
    if (reason) {
      setExplain(reason);
      return;
    }
    setExplain(null);
    act(route, { propertyId: property.id }).catch(() => {}); // act() already showed the error
  }

  const control = (route, reason, label, content, extra = '') => (
    <button
      type="button"
      className={`ui-btn ui-btn--secondary ui-btn--sm manage__btn ${extra}`}
      aria-disabled={reason ? 'true' : undefined}
      disabled={busy}
      aria-label={reason ? `${label}. Not now: ${reason}` : label}
      title={reason || label}
      onClick={() => run(route, reason)}
    >
      {pendingRoute === route ? <Spinner /> : content}
    </button>
  );

  const hint = explain || (showBuildReason && isStreet && m.build && !property.is_mortgaged ? m.build : null);

  return (
    <div className="manage">
      <div className="manage__row">
        {isStreet && (
          <span className="manage__build">
            {control('sell-building', m.sell, `Sell a building on ${property.name} for ${money(Math.floor((property.house_cost || 0) / 2))}`, <Icon name="minus" size={20} />, 'manage__square')}
            <Houses count={property.house_count} />
            {control('build', m.build, `Build on ${property.name} for ${money(property.house_cost)}`, <><Icon name="plus" size={18} /><span className="ui-money">{money(property.house_cost)}</span></>)}
          </span>
        )}
        {property.is_mortgaged
          ? control('unmortgage', m.unmortgage, `Unmortgage ${property.name} for ${money(m.unmortgageCost)}`, (
            <span className="ui-btn__stack"><span>Unmortgage</span><span className="ui-btn__sub ui-money">−{money(m.unmortgageCost)}</span></span>
          ), 'manage__mortgage')
          : control('mortgage', m.mortgage, `Mortgage ${property.name} for ${money(property.mortgage_value)}`, (
            <span className="ui-btn__stack"><span>Mortgage</span><span className="ui-btn__sub ui-money">+{money(property.mortgage_value)}</span></span>
          ), 'manage__mortgage')}
      </div>
      {hint && <p className="ui-reason" role="status">{hint}</p>}
    </div>
  );
}
