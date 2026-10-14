import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { GROUP_LABELS, PROPERTY_COLORS } from '../../lib/board';
import { money, plural } from '../../lib/format';
import { bankruptcyHeir, creditorNames, groupHoldings, joinNames, rentNowLabel, totalOwed } from '../../lib/rules';
import Icon from '../ui/Icon';
import { RollingMoney, Spinner, Swatch } from './bits';
import ConfirmDialog from './ConfirmDialog';
import ManageControls from './ManageControls';
import './sheets.css';

function DebtHeader({ me, debts, players, actions, pendingAction, act }) {
  const [confirm, setConfirm] = useState(false);
  const owed = totalOwed(debts);
  const short = Math.max(0, owed - me.money);
  const pct = owed ? Math.min(100, Math.round((me.money / owed) * 100)) : 100;
  const to = joinNames(creditorNames(debts, players, me));
  const heir = bankruptcyHeir(debts, players);
  const run = route => act(route).catch(() => {});
  const canPay = !!actions.payDebts?.ok;

  return (
    <div className="mine__debt">
      <p className="mine__debt-title">
        {short ? <>Raise <span className="ui-money">{money(short)}</span> to pay {to}</> : <>Pay {to} <span className="ui-money">{money(owed)}</span></>}
      </p>
      <p className="mine__debt-sub">You owe <span className="ui-money">{money(owed)}</span> and have <span className="ui-money">{money(me.money)}</span>. Sell buildings or mortgage below.</p>
      <div className="ui-meter" style={{ '--value': `${pct}%` }} role="progressbar" aria-valuemin={0} aria-valuemax={owed} aria-valuenow={Math.min(me.money, owed)} aria-label="Cash toward what you owe" />
      <div className="mine__debt-actions">
        <button
          type="button"
          className={`ui-btn ${canPay ? 'ui-btn--primary' : 'ui-btn--secondary'}`}
          disabled={!canPay || pendingAction != null}
          onClick={() => run('pay-debts')}
        >
          {pendingAction === 'pay-debts' && <Spinner />}
          <span>Pay <span className="ui-money">{money(owed)}</span></span>
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger"
          disabled={!actions.bankrupt?.ok || pendingAction != null}
          onClick={() => setConfirm(true)}
        >
          Declare bankruptcy
        </button>
      </div>
      {!canPay && actions.payDebts?.reason && <p className="ui-reason">{actions.payDebts.reason}</p>}
      <ConfirmDialog
        open={confirm}
        title="Declare bankruptcy?"
        confirmLabel="Go bankrupt"
        busy={pendingAction === 'bankrupt'}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          run('bankrupt');
        }}
      >
        <p>You leave the game for good.</p>
        <p>
          {heir
            ? `${heir.username} takes your cash, your properties (still mortgaged) and your jail cards.`
            : 'Your properties go back to the bank and your cash pays your creditors as far as it goes.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * "My properties": every property I own, by set in board order, with build / sell / mortgage controls.
 * Desktop: a 420px drawer on the right. Phone: the "Mine" sheet over the board. Opens by itself when I owe.
 */
export default function MyPropertiesDrawer({ open }) {
  const { properties, players, game, pendingAction, act, closeSheet, openProperty, openTrade, supply } = useGameStore(useShallow(s => ({
    properties: s.properties,
    players: s.players,
    game: s.game,
    pendingAction: s.pendingAction,
    act: s.act,
    closeSheet: s.closeSheet,
    openProperty: s.openProperty,
    openTrade: s.openTrade,
    supply: s.supply
  })));
  const me = useGameStore(selectMyPlayer);
  const isMyTurn = useGameStore(selectIsMyTurn);

  if (!me) return null;

  const ts = game?.turn_state || {};
  const inDebt = isMyTurn && ts.phase === 'debt';
  const groups = groupHoldings(me.id, properties);
  const active = game?.status === 'in_progress' && !me.is_bankrupt;

  return (
    <aside className={`g-pane mine${inDebt ? ' is-debt' : ''}`} data-active={open} aria-labelledby="mine-title" hidden={!open}>
      <header className="mine__head">
        <div>
          <h2 id="mine-title" className="ui-pane-title mine__title">My properties</h2>
          <p className="mine__cash">
            Cash <RollingMoney value={me.money} />
            {me.get_out_of_jail_cards > 0 && (
              <span className="ui-tag"><Icon name="card" size={14} />{me.get_out_of_jail_cards === 1 ? 'Free card' : `${me.get_out_of_jail_cards} free cards`}</span>
            )}
          </p>
        </div>
        <button type="button" className="ui-btn ui-btn--icon ui-btn--ghost" aria-label="Close my properties" onClick={closeSheet}>
          <Icon name="close" />
        </button>
      </header>

      {inDebt && (
        <DebtHeader me={me} debts={ts.debts || []} players={players} actions={ts.actions || {}} pendingAction={pendingAction} act={act} />
      )}

      <div className="mine__scroll">
        {groups.length === 0 ? (
          <p className="mine__empty">You don't own anything yet. Land on an unowned space and buy it.</p>
        ) : (
          groups.map(g => {
            const sample = g.items[0];
            const isStreets = sample.property_type === 'property';
            return (
              <section key={g.key} className="mine__group" aria-label={GROUP_LABELS[g.key]}>
                <h3 className="mine__group-title">
                  <Swatch color={PROPERTY_COLORS[g.key]} />
                  {GROUP_LABELS[g.key]}
                  <span className={`mine__count${g.complete ? ' is-full' : ''}`}>
                    {g.complete ? <><Icon name="check" size={14} />Full set</> : `${g.owned} of ${g.total}`}
                  </span>
                  {isStreets && <span className="mine__house-cost">Houses <span className="ui-money">{money(sample.house_cost)}</span></span>}
                </h3>
                {isStreets && !g.complete && <p className="mine__hint">Own all {g.total} to build.</p>}
                <ul className="mine__list">
                  {g.items.map(p => (
                    <li key={p.id} className={`mine__item${p.is_mortgaged ? ' is-mortgaged' : ''}`}>
                      <div className="mine__item-head">
                        <button type="button" className="mine__name" onClick={() => openProperty(p.position_on_board)}>{p.name}</button>
                        {p.is_mortgaged
                          ? <span className="ui-tag ui-tag--stop">Mortgaged</span>
                          : <span className="mine__rent">Rent <span className="ui-money">{rentNowLabel(p)}</span></span>}
                      </div>
                      {active && <ManageControls property={p} showBuildReason={g.complete} />}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <footer className="mine__foot">
        {supply && (
          <span className="mine__supply">
            <Icon name="bank" size={18} />
            The bank has {plural(supply.houses, 'house')} and {plural(supply.hotels, 'hotel')} left
          </span>
        )}
        {active && (
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => openTrade()}>
            <Icon name="trade" size={20} />
            Trade
          </button>
        )}
      </footer>
    </aside>
  );
}
