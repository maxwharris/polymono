import { useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectCurrentPlayer, selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { JAIL_FINE, MAX_JAIL_ATTEMPTS, spaceName } from '../../lib/board';
import { money } from '../../lib/format';
import { bankruptcyHeir, creditorNames, debtLabel, joinNames, totalOwed } from '../../lib/rules';
import useBoardHold from '../../hooks/useBoardHold';
import useMediaQuery, { PHONE_QUERY, prefersReducedMotion } from '../../hooks/useMediaQuery';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { upNextLine } from '../ui/turnOrder';
import { Countdown, Dice, FitHeadline, Spinner } from './bits';
import BuyOffer, { DeedFlight } from './BuyOffer';
import ConfirmDialog from './ConfirmDialog';
import './panel.css';

const STAMP_MS = 220; // the medallion lands on the deed before the purchase is sent

/**
 * One action from turn_state.actions. A blocked action stays visible and disabled, with the server's reason
 * underneath (4.5:1). `sub` adds a second line inside the button ("Leaves you $1,160").
 */
function ActionButton({ action, route, pendingAction, onRun, tone = 'primary', size = 'lg', icon, sub, held = false, className = '', children }) {
  const reasonId = useId();
  const ok = !!action?.ok;
  const busy = pendingAction === route;
  const reason = !ok && action?.reason;
  return (
    <div className={`tp__action ${className}`}>
      <button
        type="button"
        className={`ui-btn ui-btn--${tone} ui-btn--${size} ui-btn--block`}
        disabled={!ok || held || pendingAction != null}
        aria-busy={busy || undefined}
        aria-describedby={reason ? reasonId : undefined}
        onClick={() => onRun(route)}
      >
        {busy ? <Spinner /> : icon && <Icon name={icon} size={22} />}
        {sub ? (
          <span className="ui-btn__stack">
            <span>{children}</span>
            <span className="ui-btn__sub">{sub}</span>
          </span>
        ) : (
          <span>{children}</span>
        )}
      </button>
      {reason && <p id={reasonId} className="ui-reason">{reason}</p>}
    </div>
  );
}

const rolledText = roll => (roll?.die1 ? `Rolled ${roll.die1} and ${roll.die2}.` : '');

/** One sub line: a sentence, then the countdown. */
function Sub({ text, deadline, suffix, icon }) {
  return (
    <>
      {icon && <Icon name={icon} size={15} />}
      {text && <span className="tp__sub-text">{text}</span>}
      {deadline && <Countdown deadline={deadline} suffix={suffix} />}
    </>
  );
}

// What everyone who isn't playing this turn sees: [{ key, headline, sub }], the first that fits one line wins.
function watcherOptions(current, ts, properties, me, deadline) {
  const name = current.username;
  switch (ts.phase) {
    case 'roll':
      if (current.is_in_jail && !ts.rolled) {
        const attempt = Math.min(current.jail_turns + 1, MAX_JAIL_ATTEMPTS);
        return [{ key: 'jail', headline: `${name} is in Rikers`, sub: <Sub icon="bars" text={`Attempt ${attempt} of ${MAX_JAIL_ATTEMPTS}.`} deadline={deadline} /> }];
      }
      if (ts.rolled) {
        return [
          { key: 'doubles', headline: `${name} rolled doubles`, sub: <Sub text="And goes again." deadline={deadline} /> },
          { key: 'doubles-short', headline: `${name} rolled doubles`, sub: <Sub text="And goes again." /> }
        ];
      }
      return [{ key: 'up', headline: `${name} is up`, sub: <Sub deadline={deadline} suffix=" left to roll" /> }];
    case 'buy': {
      const place = properties.find(p => p.id === ts.pendingPropertyId)?.name || 'a property';
      return [
        { key: 'deciding', headline: `${name} is deciding on ${place}`, sub: <Sub deadline={deadline} suffix=" left to choose" /> },
        { key: 'deciding-short', headline: `${name} is deciding`, sub: <Sub text={`On ${place}.`} /> }
      ];
    }
    case 'debt': {
      const owed = totalOwed(ts.debts);
      const short = Math.max(0, owed - current.money);
      const toMe = me ? totalOwed((ts.debts || []).filter(d => d.creditorId === me.id)) : 0;
      const headline = toMe
        ? <>{name} owes you <span className="ui-money">{money(toMe)}</span></>
        : <>{name} owes <span className="ui-money">{money(owed)}</span></>;
      return [{ key: 'debt', headline, sub: <Sub text={short ? `Raising ${money(short)}.` : 'Paying up.'} deadline={deadline} /> }];
    }
    case 'end':
      return [{ key: 'end', headline: `${name}'s turn is ending`, sub: null }];
    default:
      return [{ key: 'playing', headline: `${name} is playing`, sub: <Sub deadline={deadline} /> }];
  }
}

/**
 * The bottom action panel. Everything it offers comes from game.turn_state.phase and game.turn_state.actions
 * (computed by the server); it never decides rules itself. Turns end on their own: there is no End turn.
 * While the board is still rolling or walking (useBoardHold), it does not tell you where anyone lands.
 */
export default function TurnActionPanel() {
  const { game, players, properties, isSpectator, pendingAction, incomingTradeCount, act, openSheet, openTrade, showResults } =
    useGameStore(useShallow(s => ({
      game: s.game,
      players: s.players,
      properties: s.properties,
      isSpectator: s.isSpectator,
      pendingAction: s.pendingAction,
      incomingTradeCount: s.incomingTradeCount,
      act: s.act,
      openSheet: s.openSheet,
      openTrade: s.openTrade,
      showResults: s.showResults
    })));
  const me = useGameStore(selectMyPlayer);
  const actual = useGameStore(selectCurrentPlayer);
  const isMyTurnNow = useGameStore(selectIsMyTurn);
  const hold = useBoardHold();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const headlineId = useId();
  const [confirmBankrupt, setConfirmBankrupt] = useState(false);
  const [stamping, setStamping] = useState(null); // property id whose deed is being stamped
  const [flight, setFlight] = useState(null);
  const deedRef = useRef(null);

  const run = route => act(route).catch(() => {}); // act() already showed the error

  if (!game) return null;
  const ts = game.turn_state || {};
  const actions = ts.actions || {};
  const deadline = game.turn_deadline;
  const canPlay = !!me && !me.is_bankrupt;
  const medSize = isPhone ? 40 : 48;

  // While the board still shows someone else's move, the panel follows the board, not the snapshot.
  const current = hold.held && hold.mover && hold.mover.id !== actual?.id ? hold.mover : actual;
  const isMyTurn = isMyTurnNow && current?.id === me?.id;

  const more = canPlay && (
    <div className="tp__more">
      <button type="button" className="ui-btn ui-btn--ghost" onClick={() => openSheet('mine')} data-flight-target="3">
        <Icon name="deed" size={22} />
        My properties
      </button>
      <button type="button" className="ui-btn ui-btn--ghost" onClick={() => openTrade()}>
        <Icon name="trade" size={22} />
        Trade
        {incomingTradeCount > 0 && <span className="ui-badge">{incomingTradeCount}<span className="sr-only"> offers waiting</span></span>}
      </button>
    </div>
  );

  function frame({ tone, phase, player, options, dice, body, buttons, inline = false, showMore = true }) {
    const head = (
      <div className={`tp__head${inline && !isPhone ? ' is-inline' : ''}`}>
        {player ? <Medallion player={player} size={medSize} current={tone === 'mine'} /> : <span className="tp__med-gap" />}
        <FitHeadline options={options} id={headlineId} />
        {dice && <Dice roll={dice} className="tp__dice" />}
        {inline && !isPhone && buttons && <div className="tp__acts tp__acts--inline">{buttons}</div>}
      </div>
    );
    return (
      <section className={`tp tp--${tone} tp--${phase}`} aria-labelledby={headlineId}>
        {head}
        {body && <div className="tp__body">{body}</div>}
        {buttons && !(inline && !isPhone) && <div className="tp__acts">{buttons}</div>}
        {showMore && more}
        {flight && <DeedFlight flight={flight} onDone={() => setFlight(null)} />}
      </section>
    );
  }

  // ---- game over ------------------------------------------------------------------------------------
  if (game.status === 'completed') {
    const winner = players.find(p => p.user_id === game.winner_user_id);
    const headline = winner ? (winner.id === me?.id ? 'You won the game' : `${winner.username} won the game`) : 'The game is over';
    return frame({
      tone: 'over',
      phase: 'over',
      player: winner,
      options: [{ key: 'over', headline, sub: <Sub icon="crown" text="See the standings and the stats." /> }],
      buttons: <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" onClick={showResults}>Results</button>,
      inline: true,
      showMore: false
    });
  }

  if (!current) {
    return frame({ tone: 'watch', phase: 'idle', options: [{ key: 'idle', headline: 'Waiting for the next turn', sub: null }], showMore: false });
  }

  // ---- held: the dice are rolling or a token is walking ------------------------------------------------
  if (hold.held && (hold.rolling || hold.mover)) {
    const label = hold.walking ? 'Moving…' : 'Rolling…';
    if (isMyTurn || (hold.rolling && isMyTurnNow)) {
      return frame({
        tone: 'mine',
        phase: 'held',
        player: me,
        options: [{ key: `held-${label}`, headline: label, sub: <Sub text="Watch the board." /> }],
        buttons: (
          <div className="tp__action">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled aria-busy="true">
              <Spinner />
              <span>{label}</span>
            </button>
          </div>
        ),
        inline: true,
        showMore: !isPhone
      });
    }
    return frame({
      tone: 'watch',
      phase: 'held',
      player: current,
      options: [{ key: `held-${current.id}-${label}`, headline: `${current.username} is ${hold.walking ? 'moving' : 'rolling'}…`, sub: <Sub deadline={deadline} /> }],
      body: <WaitingWell me={me} isSpectator={isSpectator} players={players} currentUserId={current.user_id} />
    });
  }

  // ---- everyone whose turn it isn't: spectators, the bankrupt, the others ------------------------------
  if (!isMyTurn) {
    const fresh = ts.rolled && ts.lastRoll && ts.phase !== 'roll' ? ts.lastRoll : ts.rolled ? ts.lastRoll : null;
    return frame({
      tone: 'watch',
      phase: ts.phase || 'watch',
      player: current,
      options: watcherOptions(current, ts, properties, me, deadline),
      dice: fresh,
      body: <WaitingWell me={me} isSpectator={isSpectator} players={players} currentUserId={current.user_id} />
    });
  }

  // ---- my turn --------------------------------------------------------------------------------------
  const shared = { pendingAction, onRun: run };
  const roll = ts.lastRoll;

  if (ts.phase === 'roll' && me.is_in_jail && !ts.rolled) {
    const attempt = Math.min(me.jail_turns + 1, MAX_JAIL_ATTEMPTS);
    return frame({
      tone: 'mine',
      phase: 'jail',
      player: me,
      options: [
        { key: 'jail', headline: "You're in Rikers", sub: <Sub icon="bars" text={`Attempt ${attempt} of ${MAX_JAIL_ATTEMPTS}. Doubles get you out.`} /> },
        { key: 'jail-short', headline: "You're in Rikers", sub: <Sub icon="bars" text={`Attempt ${attempt} of ${MAX_JAIL_ATTEMPTS}.`} /> }
      ],
      buttons: (
        <>
          <ActionButton {...shared} action={actions.roll} route="roll" icon="dice">Roll for doubles</ActionButton>
          <div className="tp__pair">
            <ActionButton {...shared} action={actions.payFine} route="pay-fine" tone="secondary" size="sm">
              Pay <span className="ui-money">{money(JAIL_FINE)}</span>
            </ActionButton>
            <ActionButton {...shared} action={actions.useCard} route="use-card" tone="secondary" size="sm">
              {me.get_out_of_jail_cards > 1 ? `Use a free card (${me.get_out_of_jail_cards})` : 'Use a free card'}
            </ActionButton>
          </div>
        </>
      )
    });
  }

  if (ts.phase === 'roll') {
    const again = !!ts.rolled;
    return frame({
      tone: 'mine',
      phase: 'roll',
      player: me,
      // the dice beside the headline show the roll, so the sub line can drop it
      options: again
        ? [
            { key: 'doubles', headline: 'Doubles! Roll again', sub: <Sub text={rolledText(roll)} deadline={deadline} /> },
            { key: 'doubles-short', headline: 'Doubles! Roll again', sub: <Sub deadline={deadline} /> }
          ]
        : [{ key: 'turn', headline: 'Your turn', sub: <Sub deadline={deadline} suffix=" left to roll" /> }],
      dice: again ? roll : null,
      buttons: <ActionButton {...shared} action={actions.roll} route="roll" icon="dice">{again ? 'Roll again' : 'Roll'}</ActionButton>,
      inline: true
    });
  }

  if (ts.phase === 'buy') {
    const property = properties.find(p => p.id === ts.pendingPropertyId);
    const price = property?.purchase_price ?? 0;
    const name = property?.name || 'this property';
    const rolled = rolledText(roll);

    const buy = async () => {
      if (!property) return;
      const rect = deedRef.current?.getBoundingClientRect();
      if (!prefersReducedMotion()) {
        setStamping(property.id);
        await new Promise(resolve => setTimeout(resolve, STAMP_MS));
      }
      try {
        await act('buy');
        if (rect) setFlight({ rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, property, me });
      } catch {
        // act() already showed the error
      } finally {
        setStamping(null);
      }
    };

    return frame({
      tone: 'mine',
      phase: 'buy',
      player: me,
      // longest first; the dice beside the headline show the roll, so it is the first thing to drop
      options: [
        { key: 'landed', headline: <>You landed on <em>{name}</em></>, sub: <Sub text={`${rolled} Your move.`.trim()} /> },
        { key: 'landed-mid', headline: <>You landed on <em>{name}</em></>, sub: <Sub text="Your move." /> },
        { key: 'landed-short', headline: <em>{name}</em>, sub: <Sub text={`You landed here. ${rolled}`.trim()} /> },
        { key: 'landed-shortest', headline: <em>{name}</em>, sub: <Sub text="You landed here." /> }
      ],
      dice: roll,
      body: property && (
        <BuyOffer property={property} me={me} players={players} properties={properties} stamping={stamping === property.id} deedRef={deedRef} />
      ),
      buttons: (
        <div className="tp__buy">
          <ActionButton
            {...shared}
            onRun={buy}
            action={stamping ? { ok: true } : actions.buy}
            route="buy"
            sub={actions.buy?.ok ? <>Leaves you <span className="ui-money">{money(me.money - price)}</span></> : null}
          >
            Buy for <span className="ui-money">{money(price)}</span>
          </ActionButton>
          <ActionButton {...shared} action={stamping ? { ok: false } : actions.decline} route="decline" tone="secondary">Pass</ActionButton>
        </div>
      ),
      showMore: !isPhone // small phones: My properties and Trade stay in the tab bar (graft A7)
    });
  }

  if (ts.phase === 'debt') {
    const debts = ts.debts || [];
    const owed = totalOwed(debts);
    const short = Math.max(0, owed - me.money);
    const pct = owed ? Math.min(100, Math.round((me.money / owed) * 100)) : 100;
    const to = joinNames(creditorNames(debts, players, me));
    const heir = bankruptcyHeir(debts, players);
    const canPay = !!actions.payDebts?.ok;
    const options = short
      ? [
          { key: 'raise', headline: <>Raise <span className="ui-money">{money(short)}</span> to pay {to}</>, sub: <Sub deadline={deadline} /> },
          { key: 'raise-short', headline: <>Raise <span className="ui-money">{money(short)}</span></>, sub: <Sub text={`To pay ${to}.`} deadline={deadline} /> }
        ]
      : [
          { key: 'pay', headline: <>Pay {to} <span className="ui-money">{money(owed)}</span></>, sub: <Sub text="You have the cash now." deadline={deadline} /> },
          { key: 'pay-short', headline: 'You can pay now', sub: <Sub text={`You owe ${to} ${money(owed)}.`} /> }
        ];
    return frame({
      tone: 'mine',
      phase: 'debt',
      player: me,
      options,
      body: (
        <div className="tp-debt">
          <ul className="tp-debt__list">
            {debts.map((d, i) => (
              <li key={i}>
                <span className="tp-debt__what">
                  {debtLabel(d)}
                  <small>Owed to {joinNames(creditorNames([d], players, me))}</small>
                </span>
                <span className="ui-money">{money(d.amount)}</span>
              </li>
            ))}
          </ul>
          <div
            className="ui-meter"
            style={{ '--value': `${pct}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={owed}
            aria-valuenow={Math.min(me.money, owed)}
            aria-label="Cash toward what you owe"
          />
          <p className="tp-debt__meter"><span className="ui-money">{money(Math.min(me.money, owed))}</span> of <span className="ui-money">{money(owed)}</span> in cash</p>
        </div>
      ),
      buttons: (
        <>
          <ActionButton {...shared} action={actions.payDebts} route="pay-debts" tone={canPay ? 'primary' : 'secondary'}>
            Pay <span className="ui-money">{money(owed)}</span>
          </ActionButton>
          <div className="tp__pair">
            <button type="button" className={`ui-btn ${canPay ? 'ui-btn--secondary' : 'ui-btn--primary'} ui-btn--block`} onClick={() => openSheet('mine')}>
              Sell or mortgage
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--danger ui-btn--block"
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
      ),
      showMore: !isPhone
    });
  }

  // 'end' is transient: the server hands the turn on by itself as soon as nothing is left to decide.
  const place = me.is_in_jail ? 'Rikers' : spaceName(me.position);
  return frame({
    tone: 'mine',
    phase: 'end',
    player: me,
    // at 375px "Rolled 6 and 1. Your turn is ending." does not fit beside the dice, which show the roll anyway
    options: [
      { key: 'end', headline: <>Landed on <em>{place}</em></>, sub: <Sub text={`${rolledText(roll)} Your turn is ending.`.trim()} /> },
      { key: 'end-mid', headline: <>Landed on <em>{place}</em></>, sub: <Sub text="Your turn is ending." /> },
      { key: 'end-short', headline: <em>{place}</em>, sub: <Sub text="Your turn is ending." /> }
    ],
    dice: roll,
    showMore: true
  });
}

/** The calm note under a watcher's headline: nothing to do, and how far away your turn is (graft A1). */
function WaitingWell({ me, isSpectator, players, currentUserId }) {
  if (isSpectator) {
    return <p className="ui-well tp__well"><Icon name="eye" size={18} />You're watching as a spectator.</p>;
  }
  if (me?.is_bankrupt) {
    return <p className="ui-well tp__well"><Icon name="info" size={18} />You're out of this game. You can still watch and chat.</p>;
  }
  const upNext = me ? upNextLine(players, currentUserId, me.user_id) : null;
  return (
    <p className="ui-well tp__well">
      <Icon name="bell" size={18} />
      <span>Nothing needs you right now.{upNext ? <> <strong className="tp__upnext">{upNext}.</strong></> : null}</span>
    </p>
  );
}
