import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { money } from '../../lib/format';
import { HousePips, Spinner } from './bits';

/**
 * Build / sell / mortgage / unmortgage for one of my properties, from the server's `management`
 * (null = allowed, string = why not). A blocked control stays tappable and explains itself inline.
 * `showBuildReason` prints the build reason up front (used once the player owns the whole set).
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

  const control = (route, reason, label, content, extraClass = '') => (
    <button
      type="button"
      className={`g-btn g-btn--small ${extraClass}`}
      aria-disabled={reason ? 'true' : undefined}
      disabled={busy}
      aria-label={label}
      title={reason || label}
      onClick={() => run(route, reason)}
    >
      {pendingRoute === route ? <Spinner /> : content}
    </button>
  );

  const hint = explain || (showBuildReason && isStreet && m.build && !property.is_mortgaged ? m.build : null);

  return (
    <div className="g-manage">
      <div className="g-manage-row">
        {isStreet && (
          <span className="g-manage-build">
            {control('sell-building', m.sell, `Sell a building on ${property.name} for ${money(Math.floor((property.house_cost || 0) / 2))}`, '−', 'g-btn--square')}
            <HousePips count={property.house_count} />
            {control('build', m.build, `Build on ${property.name} for ${money(property.house_cost)}`, <>+<span className="g-manage-cost money">{money(property.house_cost)}</span></>, 'g-btn--build')}
          </span>
        )}
        {property.is_mortgaged
          ? control('unmortgage', m.unmortgage, `Unmortgage ${property.name} for ${money(m.unmortgageCost)}`, <>Unmortgage <span className="money">−{money(m.unmortgageCost)}</span></>)
          : control('mortgage', m.mortgage, `Mortgage ${property.name} for ${money(property.mortgage_value)}`, <>Mortgage <span className="money">+{money(property.mortgage_value)}</span></>)}
      </div>
      {hint && <p className="g-reason" role="status">{hint}</p>}
    </div>
  );
}
