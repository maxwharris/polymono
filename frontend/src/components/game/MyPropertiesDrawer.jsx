import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { GROUP_LABELS, PROPERTY_COLORS } from '../../lib/board';
import { money, plural } from '../../lib/format';
import { bankruptcyHeir, groupHoldings, rentNowLabel, totalOwed } from '../../lib/rules';
import { Spinner } from './bits';
import ConfirmDialog from './ConfirmDialog';
import ManageControls from './ManageControls';

function DebtHeader({ me, debts, players, actions, pendingAction, act }) {
  const [confirm, setConfirm] = useState(false);
  const owed = totalOwed(debts);
  const short = Math.max(0, owed - me.money);
  const pct = owed ? Math.min(100, Math.round((me.money / owed) * 100)) : 100;
  const creditors = [...new Set(debts.map(d => d.creditorId))]
    .map(id => (id == null ? 'the bank' : players.find(p => p.id === id)?.username || 'a player'));
  const heir = bankruptcyHeir(debts, players);
  const run = route => act(route).catch(() => {});

  return (
    <div className="mine-debt">
      <p className="mine-debt-title">{short ? `Raise ${money(short)}` : 'You have enough to pay'}</p>
      <p className="mine-debt-sub">You owe {money(owed)} to {creditors.join(' and ')}.</p>
      <div className="g-meter" role="progressbar" aria-valuemin={0} aria-valuemax={owed} aria-valuenow={Math.min(me.money, owed)} aria-label="Cash toward what you owe">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="mine-debt-actions">
        <button
          type="button"
          className="g-btn g-btn--primary"
          disabled={!actions.payDebts?.ok || pendingAction != null}
          onClick={() => run('pay-debts')}
        >
          {pendingAction === 'pay-debts' && <Spinner />}Pay <span className="money">{money(owed)}</span>
        </button>
        <button
          type="button"
          className="g-btn g-btn--danger"
          disabled={!actions.bankrupt?.ok || pendingAction != null}
          onClick={() => setConfirm(true)}
        >
          Declare bankruptcy
        </button>
      </div>
      {!actions.payDebts?.ok && actions.payDebts?.reason && <p className="g-reason">{actions.payDebts.reason}</p>}
      <ConfirmDialog
        open={confirm}
        title="Declare bankruptcy?"
        confirmLabel="Go bankrupt"
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
 * Desktop: a drawer on the right. Phone: the "Mine" sheet over the board. Opens by itself when I owe money.
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

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closeSheet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeSheet]);

  if (!me) return null;

  const ts = game?.turn_state || {};
  const inDebt = isMyTurn && ts.phase === 'debt';
  const groups = groupHoldings(me.id, properties);
  const active = game?.status === 'in_progress' && !me.is_bankrupt;

  return (
    <aside className={`g-pane mine${inDebt ? ' is-debt' : ''}`} data-active={open} aria-label="My properties" hidden={!open}>
      <header className="mine-head">
        <div>
          <h2 className="g-pane-title">My properties</h2>
          <p className="mine-cash">Cash <strong className="money">{money(me.money)}</strong>
            {me.get_out_of_jail_cards > 0 && <span className="g-tag">🎴×{me.get_out_of_jail_cards}</span>}
          </p>
        </div>
        <button type="button" className="g-icon-btn" aria-label="Close my properties" onClick={closeSheet}>×</button>
      </header>

      {inDebt && (
        <DebtHeader me={me} debts={ts.debts || []} players={players} actions={ts.actions || {}} pendingAction={pendingAction} act={act} />
      )}

      <div className="mine-scroll">
        {groups.length === 0 ? (
          <p className="g-empty">You don't own anything yet. Land on an unowned space and buy it.</p>
        ) : (
          groups.map(g => {
            const sample = g.items[0];
            const isStreets = sample.property_type === 'property';
            return (
              <section key={g.key} className="mine-group" style={{ '--set': PROPERTY_COLORS[g.key] }}>
                <h3 className="mine-group-title">
                  <span className="g-swatch" aria-hidden="true" />
                  {GROUP_LABELS[g.key]}
                  <span className={`ps-count${g.complete ? ' is-complete' : ''}`}>{g.complete ? 'Full set ✓' : `${g.owned} of ${g.total}`}</span>
                  {isStreets && <span className="mine-house-cost">Houses <span className="money">{money(sample.house_cost)}</span></span>}
                </h3>
                {isStreets && !g.complete && <p className="mine-hint">Own all {g.total} to build.</p>}
                <ul className="mine-list">
                  {g.items.map(p => (
                    <li key={p.id} className={`mine-item${p.is_mortgaged ? ' is-mortgaged' : ''}`}>
                      <div className="mine-item-head">
                        <button type="button" className="mine-name" onClick={() => openProperty(p.position_on_board)}>{p.name}</button>
                        <span className="mine-rent">
                          {p.is_mortgaged ? <span className="pc-badge">Mortgaged</span> : <>Rent <span className="money">{rentNowLabel(p)}</span></>}
                        </span>
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

      <footer className="mine-foot">
        {supply && <span className="mine-supply">Bank: {plural(supply.houses, 'house')}, {plural(supply.hotels, 'hotel')}</span>}
        {active && (
          <button type="button" className="g-btn g-btn--ghost" onClick={() => openTrade()}>
            <span aria-hidden="true">🤝</span> Trade
          </button>
        )}
      </footer>
    </aside>
  );
}
