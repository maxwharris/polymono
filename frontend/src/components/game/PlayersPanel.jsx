import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { GROUP_LABELS, MAX_JAIL_ATTEMPTS, PROPERTY_COLORS } from '../../lib/board';
import { playerColor } from '../../lib/colors';
import { money, plural } from '../../lib/format';
import { groupHoldings, netWorth, setProgress } from '../../lib/rules';
import useBoardHold from '../../hooks/useBoardHold';
import useCountdown from '../../hooks/useCountdown';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { seatOrder } from '../ui/turnOrder';
import { RollingMoney } from './bits';
import PropertyCard from './PropertyCard';
import './players.css';

/**
 * The set strip: one cell per property, grouped by set in board order. Owned cells fill in the group colour
 * from the left; a finished set's cells join into one bar with a brass outline (a monopoly at a glance).
 */
function SetStrip({ playerId, properties }) {
  const sets = setProgress(playerId, properties);
  const owned = sets.filter(s => s.owned > 0);
  const label = owned.length
    ? `Owns ${owned.map(s => (s.complete ? `all ${s.total} ${GROUP_LABELS[s.key].toLowerCase()}` : `${s.owned} of ${s.total} ${GROUP_LABELS[s.key].toLowerCase()}`)).join(', ')}`
    : 'Owns no properties';
  return (
    <span className="sets" role="img" aria-label={label}>
      {sets.map(s => (
        <span key={s.key} className={`sets__group${s.complete ? ' is-full' : ''}`} style={{ '--g': PROPERTY_COLORS[s.key] }}>
          {s.complete
            ? <i className="sets__bar" style={{ '--n': s.total }} />
            : Array.from({ length: s.total }, (_, i) => <i key={i} className={i < s.owned ? 'is-on' : undefined} />)}
        </span>
      ))}
    </span>
  );
}

/** "Up now, 21h 40m left" in brass for whoever is up; Rikers and free cards with their icons. */
function Status({ player, isCurrent, isNext, deadline }) {
  const { label } = useCountdown(isCurrent ? deadline : null);
  const items = [];
  if (player.is_bankrupt) items.push({ key: 'out', icon: 'close', text: 'Bankrupt' });
  // compact: "Up now, 20h left" (the exact countdown is in the top bar and the turn panel)
  const short = label && label !== 'overdue' ? label.replace(/^(\d+[dh]) \d+[hm]$/, '$1') : null;
  if (isCurrent) items.push({ key: 'up', icon: 'clock', text: short ? `Up now, ${short} left` : 'Up now', up: true });
  if (player.is_in_jail && !player.is_bankrupt) {
    items.push({ key: 'jail', icon: 'bars', text: `In Rikers, try ${Math.min(player.jail_turns + 1, MAX_JAIL_ATTEMPTS)} of ${MAX_JAIL_ATTEMPTS}` });
  }
  if (player.get_out_of_jail_cards > 0 && !player.is_bankrupt) {
    items.push({ key: 'card', icon: 'card', text: player.get_out_of_jail_cards === 1 ? 'Holds a free card' : `Holds ${player.get_out_of_jail_cards} free cards` });
  }
  if (!items.length && isNext) items.push({ key: 'next', icon: null, text: 'Up next' });
  if (!items.length) return null;
  return (
    <span className="prow__status">
      {items.map(item => (
        <span key={item.key} className={`prow__st${item.up ? ' is-up' : ''}`}>
          {item.icon && <Icon name={item.icon} size={15} />}
          {item.text}
        </span>
      ))}
    </span>
  );
}

function PlayerRow({ player, properties, isCurrent, isNext, deadline, online, isMe, held, onOpen }) {
  const out = !!player.is_bankrupt;
  return (
    <li>
      <button
        type="button"
        className={`ui-row prow${isCurrent ? ' is-current' : ''}${out ? ' is-out' : ''}`}
        style={{ '--pc': playerColor(player) }}
        onClick={() => onOpen(player.id)}
        aria-label={`${player.username}${isMe ? ' (you)' : ''}: ${money(player.money)} cash. Show holdings`}
      >
        <Medallion player={player} size={42} online={online} current={isCurrent} />
        <span className="prow__main">
          <span className="prow__name">
            <span className="prow__username">{player.username}</span>
            {isMe && <span className="ui-tag">you</span>}
          </span>
          <Status player={player} isCurrent={isCurrent} isNext={isNext} deadline={deadline} />
        </span>
        <span className="prow__cash">
          {out ? <span className="prow__worth">Out</span> : (
            <>
              <RollingMoney value={player.money} hold={held} />
              <span className="prow__worth">worth <span className="ui-money">{money(netWorth(player, properties))}</span></span>
            </>
          )}
        </span>
        {!out && <SetStrip playerId={player.id} properties={properties} />}
      </button>
    </li>
  );
}

/** Desktop: your holdings under the players, read-only; "Manage" opens My properties. */
function Holdings({ me, properties, openProperty, openSheet }) {
  const rows = groupHoldings(me.id, properties).flatMap(g => g.items);
  return (
    <section className="holdings" aria-labelledby="holdings-title">
      <div className="holdings__head">
        <h2 id="holdings-title" className="ui-pane-title" data-flight-target="2">Your properties</h2>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm holdings__manage" onClick={() => openSheet('mine')}>Manage</button>
      </div>
      {rows.length ? (
        <ul className="holdings__list">
          {rows.map(p => (
            <li key={p.id}>
              <button type="button" className="holdings__row" onClick={() => openProperty(p.position_on_board)}>
                <PropertyCard property={p} variant="row" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="holdings__empty">Nothing yet. Land on an unowned space and buy it.</p>
      )}
    </section>
  );
}

export default function PlayersPanel() {
  const { players, properties, presence, currentUserId, deadline, myUserId, openPlayer, openProperty, openSheet, status, supply } = useGameStore(useShallow(s => ({
    players: s.players,
    properties: s.properties,
    presence: s.presence,
    currentUserId: s.game?.current_turn_user_id,
    deadline: s.game?.turn_deadline,
    status: s.game?.status,
    myUserId: s.isSpectator ? null : s.user?.id,
    openPlayer: s.openPlayer,
    openProperty: s.openProperty,
    openSheet: s.openSheet,
    supply: s.supply
  })));
  const me = useGameStore(selectMyPlayer);
  const hold = useBoardHold();
  const playing = status === 'in_progress';
  // Until the board has shown a move, the turn stays with whoever is moving.
  const upId = hold.held && hold.mover ? hold.mover.user_id : currentUserId;
  const order = seatOrder(players).filter(p => !p.is_bankrupt);
  const upIndex = order.findIndex(p => p.user_id === upId);
  const nextId = upIndex >= 0 && order.length > 1 ? order[(upIndex + 1) % order.length].user_id : null;

  return (
    <div className="pp">
      <h2 className="ui-pane-title pp__title">Players</h2>
      <ul className="pp__list">
        {players.map(p => (
          <PlayerRow
            key={p.id}
            player={p}
            properties={properties}
            isCurrent={playing && p.user_id === upId}
            isNext={playing && p.user_id === nextId}
            deadline={deadline}
            online={presence.includes(p.user_id)}
            isMe={p.user_id === myUserId}
            held={hold.held}
            onOpen={openPlayer}
          />
        ))}
      </ul>
      {me && <Holdings me={me} properties={properties} openProperty={openProperty} openSheet={openSheet} />}
      {supply && (
        <p className="pp__bank">
          <Icon name="bank" size={18} />
          The bank has {plural(supply.houses, 'house')} and {plural(supply.hotels, 'hotel')} left
        </p>
      )}
    </div>
  );
}
