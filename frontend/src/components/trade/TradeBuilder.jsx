import { useId, useState } from 'react';
import { tokenEmoji } from '../../lib/tokens';
import { playerColor } from '../../lib/colors';
import { money } from '../../lib/format';
import { emptySide, isEmptySide, parseAmount, prefillAdjustments, untradableReason } from './tradeUtils';
import { PlayerTag, Swatch, TermsList } from './TradeTerms';
import ui from '../screens/ui.module.css';
import s from './Trade.module.css';

const byBoard = (a, b) => a.position_on_board - b.position_on_board;

/**
 * Builds a new offer, or a counter-offer prefilled from a received one. Terms are kept from my side:
 * `give` is what I hand over (the server's "offered"), `get` is what I ask for ("requested").
 * The parent remounts it (via key) to start over.
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

  return (
    <form className={s.builder} onSubmit={handleSubmit} aria-describedby={blockedHint ? `${id}-blocked` : undefined}>
      {isCounter ? (
        <div className={s.counterBanner}>
          <p>
            Counter-offer to <PlayerTag player={partner} fallbackName={counterTrade.proposer_username} />. Their terms are
            filled in from your side; change anything, then send it back.
          </p>
          <button type="button" className={`${ui.btn} ${ui.ghost} ${ui.small}`} onClick={onAbandonCounter}>
            Start a fresh offer instead
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
          <legend className={s.stepLabel}>Trade with</legend>
          {partners.length === 0 ? (
            <p className={ui.hint}>There is nobody else in the game who can trade.</p>
          ) : (
            <div className={s.partners}>
              {partners.map(p => (
                <label key={p.id} className={s.partnerOption}>
                  <input
                    className={ui.srOnly}
                    type="radio"
                    name={`${id}-partner`}
                    value={p.id}
                    checked={partnerId === p.id}
                    onChange={() => choosePartner(p.id)}
                  />
                  <span className={s.partnerFace} style={{ '--player': playerColor(p) }}>
                    <span aria-hidden="true">{tokenEmoji(p.token_type)}</span>
                    <span className={s.partnerName}>{p.username}</span>
                    <span className={s.partnerCash}>{money(p.money)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className={s.builderSides}>
        <SideEditor
          idPrefix={`${id}-give`}
          kind="give"
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
            kind="get"
            title={`You get from ${partner.username}`}
            owner={partner}
            list={theirs}
            properties={properties}
            current={getNow}
            onChange={setGet}
          />
        ) : (
          <div className={s.sidePlaceholder}>Pick a player to see what they own.</div>
        )}
      </div>

      <section className={s.summary} aria-labelledby={`${id}-summary`}>
        <h3 id={`${id}-summary`} className={ui.srOnly}>Trade summary</h3>
        <div className={s.summaryCol}>
          <h4 className={s.giveLabel}>You give</h4>
          <TermsList side={giveNow} byId={byId} />
        </div>
        <div className={s.summaryCol}>
          <h4 className={s.getLabel}>You get</h4>
          <TermsList side={getNow} byId={byId} emptyText={partner ? 'Nothing' : '—'} />
        </div>
      </section>

      <div className={s.sendRow}>
        <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={!canSend}>
          {sending ? 'Sending…' : isCounter ? 'Send counter-offer' : partner ? `Send offer to ${partner.username}` : 'Send offer'}
        </button>
        {blockedHint && <p id={`${id}-blocked`} className={ui.hint}>{blockedHint}</p>}
      </div>
    </form>
  );
}

function SideEditor({ idPrefix, kind, title, owner, isMe = false, list, properties, current, onChange }) {
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

  function setCards(count) {
    onChange(side => ({ ...side, jailCards: Math.max(0, Math.min(count, maxCards)) }));
  }

  return (
    <section className={s.sideEditor} aria-labelledby={`${idPrefix}-title`}>
      <header className={s.sideHead}>
        <h3 id={`${idPrefix}-title`} className={kind === 'give' ? s.giveTitle : s.getTitle}>{title}</h3>
        <span className={s.sideCash}>{isMe ? 'You have' : `${owner.username} has`} {money(owner.money)}</span>
      </header>

      {list.length === 0 ? (
        <p className={s.nothing}>{isMe ? 'You have no properties.' : `${owner.username} has no properties.`}</p>
      ) : (
        <ul className={s.propList} aria-label={isMe ? 'Your properties' : `${owner.username}'s properties`}>
          {list.map(property => {
            const reason = untradableReason(property, properties);
            const selected = current.properties.includes(property.id);
            return (
              <li key={property.id}>
                <button
                  type="button"
                  className={`${ui.btn} ${s.propToggle}`}
                  aria-pressed={selected}
                  disabled={!!reason}
                  onClick={() => toggle(property.id)}
                >
                  <Swatch property={property} />
                  <span className={s.propName}>{property.name}</span>
                  <span className={reason ? s.propReason : s.propMeta}>
                    {reason || money(property.purchase_price)}
                  </span>
                  <span className={s.check} aria-hidden="true">{selected ? '✓' : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={s.amount}>
        <label className={ui.label} htmlFor={`${idPrefix}-cash`}>Cash</label>
        <div className={s.moneyField}>
          <span className={s.currency} aria-hidden="true">$</span>
          <input
            id={`${idPrefix}-cash`}
            className={ui.input}
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
        <p id={`${idPrefix}-cash-hint`} className={ui.hint}>Up to {money(maxMoney)}</p>
      </div>

      {maxCards > 0 && (
        <div className={s.stepper} role="group" aria-labelledby={`${idPrefix}-cards`}>
          <span id={`${idPrefix}-cards`} className={ui.label}>Get Out of Jail Free cards</span>
          <div className={s.stepperControls}>
            <button
              type="button"
              className={`${ui.btn} ${ui.small} ${s.stepButton}`}
              onClick={() => setCards(current.jailCards - 1)}
              disabled={current.jailCards <= 0}
              aria-label="One card fewer"
            >
              −
            </button>
            <output className={s.stepperValue} aria-live="polite">{current.jailCards}</output>
            <button
              type="button"
              className={`${ui.btn} ${ui.small} ${s.stepButton}`}
              onClick={() => setCards(current.jailCards + 1)}
              disabled={current.jailCards >= maxCards}
              aria-label="One card more"
            >
              +
            </button>
            <span className={ui.hint}>of {maxCards}</span>
          </div>
        </div>
      )}
    </section>
  );
}
