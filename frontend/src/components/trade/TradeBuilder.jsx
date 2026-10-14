import { useId, useState } from 'react';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { completedSets, emptySide, isEmptySide, parseAmount, prefillAdjustments, untradableReason } from './tradeUtils';
import { DealSentence, Swatch } from './TradeTerms';
import s from './Trade.module.css';

const byBoard = (a, b) => a.position_on_board - b.position_on_board;
const CASH_STEP = 50;

/**
 * Builds a new offer, or a counter-offer prefilled from a received one. Terms are kept from my side:
 * `give` is what I hand over (the server's "offered"), `get` is what I ask for ("requested").
 * The parent remounts it (via key) to start over.
 *
 * Layout: "Trade with" (partner medallions), then "You give" and "You get" side by side (stacked on a
 * narrow phone), each a list of 44px+ property tiles with cash (a ±$50 stepper around the input) and free
 * cards, and a sticky footer that says the deal in one sentence above the Send button.
 */
export default function TradeBuilder({ me, players, properties, byId, initial, counterTrade, onSubmit, onAbandonCounter }) {
  const [partnerId, setPartnerId] = useState(initial.partnerId ?? null);
  const [give, setGive] = useState(initial.give ?? emptySide());
  const [get, setGet] = useState(initial.get ?? emptySide());
  const [sending, setSending] = useState(false);
  const [adjustments] = useState(() => (counterTrade
    ? prefillAdjustments(initial, { me, partner: players.find(p => p.id === initial.partnerId), properties, byId })
    : []));
  const id = useId();

  const isCounter = !!counterTrade;
  const partners = players.filter(p => p.id !== me.id && !p.is_bankrupt);
  const partner = partners.find(p => p.id === partnerId) || null;

  const mine = properties.filter(p => p.owner_id === me.id).sort(byBoard);
  const theirs = partner ? properties.filter(p => p.owner_id === partner.id).sort(byBoard) : [];
  const tradableIds = list => new Set(list.filter(p => !untradableReason(p, properties)).map(p => p.id));
  const myTradable = tradableIds(mine);
  const theirTradable = tradableIds(theirs);

  // What would actually be sent: selections that are still possible, amounts within what each side has.
  const giveNow = {
    properties: give.properties.filter(pid => myTradable.has(pid)),
    money: Math.min(give.money, Math.max(0, me.money)),
    jailCards: Math.min(give.jailCards, me.get_out_of_jail_cards || 0)
  };
  const getNow = partner
    ? {
        properties: get.properties.filter(pid => theirTradable.has(pid)),
        money: Math.min(get.money, Math.max(0, partner.money)),
        jailCards: Math.min(get.jailCards, partner.get_out_of_jail_cards || 0)
      }
    : emptySide();

  const empty = isEmptySide(giveNow) && isEmptySide(getNow);
  const canSend = !!partner && !empty && !sending;
  let blockedHint = null;
  if (!partner) blockedHint = partners.length ? 'Pick who to trade with.' : 'Nobody else can trade right now.';
  else if (empty) blockedHint = 'Add something to give or to ask for.';
  const completes = partner ? completedSets(giveNow, getNow, { properties, myPlayerId: me.id }) : [];

  function choosePartner(nextId) {
    if (nextId === partnerId) return;
    setPartnerId(nextId);
    setGet(emptySide());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      await onSubmit({ partner, give: giveNow, get: getNow });
    } finally {
      setSending(false);
    }
  }

  const counterName = partner?.username || counterTrade?.proposer_username || 'their';

  return (
    <form className={s.builder} onSubmit={handleSubmit} aria-describedby={blockedHint ? `${id}-blocked` : undefined}>
      {isCounter ? (
        <div className={s.counterBanner}>
          <p className={s.counterText}>
            Countering <b>{counterName}</b>'s offer. Their terms are filled in. Change anything, then send it back.
          </p>
          <button type="button" className={`ui-btn ui-btn--ghost ui-btn--sm ${s.counterReset}`} onClick={onAbandonCounter}>
            <Icon name="refresh" size={18} />
            Start over
          </button>
          {adjustments.length > 0 && (
            <div className={s.adjustments}>
              <p className={s.adjustmentsTitle}>Changed from their offer:</p>
              <ul>
                {adjustments.map(note => <li key={note}>{note}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <fieldset className={s.partnerPicker}>
          <legend className={`ui-label ${s.stepLabel}`}>Trade with</legend>
          {partners.length === 0 ? (
            <p className="ui-hint">There is nobody else in the game who can trade.</p>
          ) : (
            <div className={s.partners}>
              {partners.map(p => (
                <label key={p.id} className={s.partnerOption}>
                  <input
                    className="sr-only"
                    type="radio"
                    name={`${id}-partner`}
                    value={p.id}
                    checked={partnerId === p.id}
                    onChange={() => choosePartner(p.id)}
                  />
                  <span className={s.partnerFace}>
                    <Medallion player={p} size={44} />
                    <span className={s.partnerName}>{p.username}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className={s.sides}>
        <SideEditor
          idPrefix={`${id}-give`}
          title="You give"
          owner={me}
          isMe
          list={mine}
          properties={properties}
          current={giveNow}
          onChange={setGive}
        />
        {partner ? (
          <SideEditor
            idPrefix={`${id}-get`}
            title="You get"
            owner={partner}
            list={theirs}
            properties={properties}
            current={getNow}
            onChange={setGet}
          />
        ) : (
          <section className={s.side} aria-label="You get">
            <h3 className={s.sideTitle}>You get</h3>
            <p className={s.sidePlaceholder}>Pick a player to see what they own.</p>
          </section>
        )}
      </div>

      <div className={s.dealBar}>
        <h3 className="sr-only">Trade summary</h3>
        {blockedHint ? (
          <p id={`${id}-blocked`} className={s.dealHint}>{blockedHint}</p>
        ) : (
          <DealSentence give={giveNow} get={getNow} byId={byId} completes={completes} />
        )}
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={!canSend}>
          {sending && <span className="ui-spinner" aria-hidden="true" />}
          {sending ? 'Sending…' : isCounter ? `Send counter-offer to ${counterName}` : partner ? `Send offer to ${partner.username}` : 'Send offer'}
        </button>
      </div>
    </form>
  );
}

function Stepper({ label, labelId, value, onLess, onMore, lessDisabled, moreDisabled, lessLabel, moreLabel, children }) {
  return (
    <div className={s.stepper} role="group" aria-labelledby={labelId} aria-label={labelId ? undefined : label}>
      <button type="button" className={`ui-btn ui-btn--secondary ${s.stepBtn}`} onClick={onLess} disabled={lessDisabled} aria-label={lessLabel}>
        <Icon name="minus" size={20} />
      </button>
      {children ?? <output className={s.stepValue} aria-live="polite">{value}</output>}
      <button type="button" className={`ui-btn ui-btn--secondary ${s.stepBtn}`} onClick={onMore} disabled={moreDisabled} aria-label={moreLabel}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

function SideEditor({ idPrefix, title, owner, isMe = false, list, properties, current, onChange }) {
  const maxMoney = Math.max(0, owner.money || 0);
  const maxCards = owner.get_out_of_jail_cards || 0;

  function toggle(propertyId) {
    onChange(side => ({
      ...side,
      properties: side.properties.includes(propertyId)
        ? side.properties.filter(pid => pid !== propertyId)
        : [...side.properties, propertyId]
    }));
  }

  function setMoney(raw) {
    const amount = parseAmount(raw, maxMoney);
    onChange(side => ({ ...side, money: amount }));
  }

  // ±$50, landing on the step (a typed $130 goes to $150 or $100), never past what they have.
  function stepMoney(direction) {
    onChange(side => {
      const now = Math.min(side.money, maxMoney);
      const next = direction > 0
        ? Math.min(maxMoney, Math.floor(now / CASH_STEP) * CASH_STEP + CASH_STEP)
        : Math.max(0, Math.ceil(now / CASH_STEP) * CASH_STEP - CASH_STEP);
      return { ...side, money: next };
    });
  }

  function setCards(count) {
    onChange(side => ({ ...side, jailCards: Math.max(0, Math.min(count, maxCards)) }));
  }

  return (
    <section className={s.side} aria-labelledby={`${idPrefix}-title`}>
      <h3 id={`${idPrefix}-title`} className={s.sideTitle}>{title}</h3>

      {list.length === 0 ? (
        <p className={s.nothing}>{isMe ? 'You have no properties.' : `${owner.username} has no properties.`}</p>
      ) : (
        <ul className={s.tiles} aria-label={isMe ? 'Your properties' : `${owner.username}'s properties`}>
          {list.map(property => {
            const reason = untradableReason(property, properties);
            const selected = current.properties.includes(property.id);
            return (
              <li key={property.id}>
                <button
                  type="button"
                  className={s.tile}
                  aria-pressed={selected}
                  disabled={!!reason}
                  onClick={() => toggle(property.id)}
                >
                  <Swatch property={property} />
                  <span className={s.tileText}>
                    <span className={s.tileName}>{property.name}</span>
                    {reason ? (
                      <span className={reason === 'Mortgaged' ? s.tileMortgaged : s.tileReason}>{reason}</span>
                    ) : (
                      <span className={`num ${s.tilePrice}`}>{money(property.purchase_price)}</span>
                    )}
                  </span>
                  {selected && <span className={s.tick} aria-hidden="true"><Icon name="check" size={14} strokeWidth={2.5} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={s.cash}>
        <label className="ui-label" htmlFor={`${idPrefix}-cash`}>Cash</label>
        <Stepper
          label="Cash"
          onLess={() => stepMoney(-1)}
          onMore={() => stepMoney(1)}
          lessDisabled={current.money <= 0}
          moreDisabled={current.money >= maxMoney}
          lessLabel={`$${CASH_STEP} less`}
          moreLabel={`$${CASH_STEP} more`}
        >
          <div className={`ui-input ${s.cashInput} ${maxMoney <= 0 ? s.cashOff : ''}`}>
            <span className="ui-input__pre" aria-hidden="true">$</span>
            <input
              id={`${idPrefix}-cash`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="0"
              value={current.money ? String(current.money) : ''}
              onChange={e => setMoney(e.target.value)}
              disabled={maxMoney <= 0}
              aria-describedby={`${idPrefix}-cash-hint`}
            />
          </div>
        </Stepper>
        <p id={`${idPrefix}-cash-hint`} className="ui-hint">
          Up to <span className="num">{money(maxMoney)}</span>
        </p>
      </div>

      {maxCards > 0 && (
        <div className={s.cards}>
          <span id={`${idPrefix}-cards`} className="ui-label">Get Out of Jail Free cards</span>
          <div className={s.cardsRow}>
            <Stepper
              labelId={`${idPrefix}-cards`}
              value={current.jailCards}
              onLess={() => setCards(current.jailCards - 1)}
              onMore={() => setCards(current.jailCards + 1)}
              lessDisabled={current.jailCards <= 0}
              moreDisabled={current.jailCards >= maxCards}
              lessLabel="One card fewer"
              moreLabel="One card more"
            />
            <span className="ui-hint">of {maxCards}</span>
          </div>
        </div>
      )}
    </section>
  );
}
