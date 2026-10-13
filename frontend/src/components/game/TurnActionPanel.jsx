import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectCurrentPlayer, selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { JAIL_FINE, MAX_JAIL_ATTEMPTS, spaceName } from '../../lib/board';
import { money } from '../../lib/format';
import { bankruptcyHeir, totalOwed } from '../../lib/rules';
import { Countdown, Dice, Spinner, TokenBadge } from './bits';
import ConfirmDialog from './ConfirmDialog';
import PropertyCard from './PropertyCard';

// One action button. A blocked action stays visible, disabled, with the server's reason underneath.
function Action({ action, route, tone = 'primary', pendingAction, onRun, children, wide = false }) {
  const ok = !!action?.ok;
  const pending = pendingAction === route;
  return (
    <div className={`tap-action${wide ? ' is-wide' : ''}`}>
      <button
        type="button"
        className={`g-btn g-btn--${tone} g-btn--large`}
        disabled={!ok || pendingAction != null}
        aria-busy={pending || undefined}
        onClick={() => onRun(route)}
      >
        {pending && <Spinner />}
        {children}
      </button>
      {!ok && action?.reason && <p className="g-reason">{action.reason}</p>}
    </div>
  );
}

function creditorName(creditorId, players, me) {
  if (creditorId == null) return 'the bank';
  if (me && creditorId === me.id) return 'you';
  return players.find(p => p.id === creditorId)?.username || 'a player';
}

// One sentence for everyone who isn't playing this turn.
function watcherLine(current, ts, properties, players, me) {
  const name = current.username;
  switch (ts.phase) {
    case 'roll':
      if (current.is_in_jail && !ts.rolled) return `${name} is in Rikers (attempt ${current.jail_turns + 1} of ${MAX_JAIL_ATTEMPTS})`;
      if (ts.rolled) return `${name} rolled doubles and goes again`;
      return `${name} is up`;
    case 'buy': {
      const pending = properties.find(p => p.id === ts.pendingPropertyId);
      return `${name} is deciding on ${pending?.name || 'a property'}`;
    }
    case 'debt': {
      const owed = totalOwed(ts.debts);
      const short = Math.max(0, owed - current.money);
      const owedToMe = me ? totalOwed((ts.debts || []).filter(d => d.creditorId === me.id)) : 0;
      const what = owedToMe ? `owes you ${money(owedToMe)}` : `owes ${money(owed)}`;
      return `${name} ${what}${short ? ` and is raising ${money(short)}` : ''}`;
    }
    case 'end':
      return `${name} is wrapping up`;
    default:
      return `${name} is playing`;
  }
}

/**
 * The bottom action panel. Everything it offers comes from game.turn_state.phase and
 * game.turn_state.actions (computed by the server); it never decides rules itself.
 */
export default function TurnActionPanel() {
  const { game, players, properties, isSpectator, pendingAction, animating, incomingTradeCount, act, openSheet, openTrade, showResults } =
    useGameStore(useShallow(s => ({
      game: s.game,
      players: s.players,
      properties: s.properties,
      isSpectator: s.isSpectator,
      pendingAction: s.pendingAction,
      animating: s.animating,
      incomingTradeCount: s.incomingTradeCount,
      act: s.act,
      openSheet: s.openSheet,
      openTrade: s.openTrade,
      showResults: s.showResults
    })));
  const me = useGameStore(selectMyPlayer);
  const current = useGameStore(selectCurrentPlayer);
  const isMyTurn = useGameStore(selectIsMyTurn);
  const [confirmBankrupt, setConfirmBankrupt] = useState(false);

  const run = route => act(route).catch(() => {}); // act() already showed the error

  if (!game) return null;
  const ts = game.turn_state || {};
  const actions = ts.actions || {};
  const deadline = game.turn_deadline;

  if (game.status === 'completed') {
    const winner = players.find(p => p.user_id === game.winner_user_id);
    return (
      <section className="tap tap--watch" aria-label="Game over">
        <div className="tap-head">
          <p className="tap-line"><span aria-hidden="true">🏆 </span>{winner ? `${winner.username} won the game` : 'The game is over'}</p>
          <button type="button" className="g-btn g-btn--primary" onClick={showResults}>Results</button>
        </div>
      </section>
    );
  }
  if (!current) {
    return <section className="tap tap--watch" aria-label="Turn"><p className="tap-line">Waiting for the next turn…</p></section>;
  }

  const canPlay = !!me && !me.is_bankrupt;
  const secondary = canPlay && (
    <div className="tap-secondary">
      <button type="button" className="g-btn g-btn--ghost" onClick={() => openSheet('mine')}>
        <span aria-hidden="true">🏘️</span> My properties
      </button>
      <button type="button" className="g-btn g-btn--ghost" onClick={() => openTrade()}>
        <span aria-hidden="true">🤝</span> Trade
        {incomingTradeCount > 0 && <span className="g-badge">{incomingTradeCount}<span className="sr-only"> offers waiting</span></span>}
      </button>
    </div>
  );

  // Watching: spectators, bankrupt players and everyone whose turn it isn't.
  if (!isMyTurn) {
    return (
      <section className="tap tap--watch" aria-label="Turn">
        <div className="tap-head">
          <TokenBadge player={current} size="sm" />
          <p className="tap-line">
            {watcherLine(current, ts, properties, players, me)}
            <Countdown deadline={deadline} className="tap-countdown" />
          </p>
          {ts.lastRoll && ts.rolled && !animating && <Dice roll={ts.lastRoll} className="tap-dice" />}
        </div>
        {isSpectator && <p className="tap-note">You are spectating. Log in to play.</p>}
        {me?.is_bankrupt && <p className="tap-note">You are out of this game. You can still watch and chat.</p>}
        {secondary}
      </section>
    );
  }

  const pendingProperty = properties.find(p => p.id === ts.pendingPropertyId);
  let headline;
  let body = null;
  let buttons;

  switch (ts.phase) {
    case 'roll':
      if (me.is_in_jail && !ts.rolled) {
        headline = `In Rikers · attempt ${me.jail_turns + 1} of ${MAX_JAIL_ATTEMPTS}`;
        buttons = (
          <>
            <Action action={actions.roll} route="roll" pendingAction={pendingAction} onRun={run} wide>
              <span aria-hidden="true">🎲</span> Roll for doubles
            </Action>
            <Action action={actions.payFine} route="pay-fine" tone="secondary" pendingAction={pendingAction} onRun={run}>
              Pay {money(JAIL_FINE)}
            </Action>
            <Action action={actions.useCard} route="use-card" tone="secondary" pendingAction={pendingAction} onRun={run}>
              Use card{me.get_out_of_jail_cards ? ` (${me.get_out_of_jail_cards})` : ''}
            </Action>
          </>
        );
      } else {
        headline = ts.rolled ? 'Doubles! Roll again' : 'Your turn';
        buttons = (
          <Action action={actions.roll} route="roll" pendingAction={pendingAction} onRun={run} wide>
            <span aria-hidden="true">🎲</span> {ts.rolled ? 'Roll again' : 'Roll'}
          </Action>
        );
      }
      break;

    case 'buy': {
      const price = pendingProperty?.purchase_price ?? 0;
      headline = pendingProperty ? `You landed on ${pendingProperty.name}` : 'Buy or pass';
      body = animating
        ? <p className="tap-wait">Moving…</p>
        : <PropertyCard property={pendingProperty} variant="compact" className="tap-card" />;
      buttons = (
        <>
          <Action action={actions.buy} route="buy" pendingAction={pendingAction} onRun={run} wide>
            Buy {pendingProperty?.name} — <span className="money">{money(price)}</span>
            {actions.buy?.ok && <span className="tap-leaves"> (leaves <span className="money">{money(me.money - price)}</span>)</span>}
          </Action>
          <Action action={actions.decline} route="decline" tone="secondary" pendingAction={pendingAction} onRun={run}>
            Pass
          </Action>
        </>
      );
      break;
    }

    case 'debt': {
      const owed = totalOwed(ts.debts);
      const short = Math.max(0, owed - me.money);
      const pct = owed ? Math.min(100, Math.round((me.money / owed) * 100)) : 100;
      const heir = bankruptcyHeir(ts.debts, players);
      headline = short ? `Raise ${money(short)} to pay your debts` : 'You can pay what you owe';
      body = (
        <div className="tap-debt">
          <ul className="tap-debts">
            {(ts.debts || []).map((d, i) => (
              <li key={i}>
                <span>{d.reason ? `${d.reason[0].toUpperCase()}${d.reason.slice(1)}` : 'Owed'} → {creditorName(d.creditorId, players, me)}</span>
                <strong className="money">{money(d.amount)}</strong>
              </li>
            ))}
          </ul>
          <div className="g-meter" role="progressbar" aria-valuemin={0} aria-valuemax={owed} aria-valuenow={Math.min(me.money, owed)} aria-label="Cash toward what you owe">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="tap-meter-label"><span className="money">{money(me.money)}</span> of <span className="money">{money(owed)}</span></p>
        </div>
      );
      buttons = (
        <>
          <Action action={actions.payDebts} route="pay-debts" pendingAction={pendingAction} onRun={run} wide>
            Pay <span className="money">{money(owed)}</span>
          </Action>
          <div className="tap-action">
            <button type="button" className="g-btn g-btn--secondary g-btn--large" onClick={() => openSheet('mine')}>
              Sell or mortgage
            </button>
          </div>
          <div className="tap-action">
            <button
              type="button"
              className="g-btn g-btn--danger g-btn--large"
              disabled={!actions.bankrupt?.ok || pendingAction != null}
              onClick={() => setConfirmBankrupt(true)}
            >
              Declare bankruptcy
            </button>
          </div>
          <ConfirmDialog
            open={confirmBankrupt}
            title="Declare bankruptcy?"
            confirmLabel="Go bankrupt"
            busy={pendingAction === 'bankrupt'}
            onCancel={() => setConfirmBankrupt(false)}
            onConfirm={() => {
              setConfirmBankrupt(false);
              run('bankrupt');
            }}
          >
            <p>You leave the game for good.</p>
            <p>
              {heir
                ? `${heir.username} takes your cash, your properties (still mortgaged) and your jail cards.`
                : 'Your properties go back to the bank and your cash pays your creditors as far as it goes.'}
            </p>
            {short > 0 && <p>You are {money(short)} short. Selling buildings or mortgaging may still cover it.</p>}
          </ConfirmDialog>
        </>
      );
      break;
    }

    case 'end':
      headline = ts.lastRoll ? `Rolled ${ts.lastRoll.total} → ${me.is_in_jail ? 'Rikers' : spaceName(me.position)}` : 'Done for this turn';
      buttons = (
        <Action action={actions.endTurn} route="end-turn" pendingAction={pendingAction} onRun={run} wide>
          End turn
        </Action>
      );
      break;

    default:
      headline = 'Your turn';
      buttons = null;
  }

  return (
    <section className={`tap tap--mine tap--${ts.phase}`} aria-label="Your turn">
      <div className="tap-head">
        <TokenBadge player={me} size="sm" />
        <p className="tap-line tap-line--strong">
          {headline}
          <Countdown deadline={deadline} className="tap-countdown" />
        </p>
        {ts.lastRoll && ts.rolled && !animating && <Dice roll={ts.lastRoll} className="tap-dice" />}
      </div>
      {body}
      <div className="tap-buttons">{buttons}</div>
      {secondary}
    </section>
  );
}
