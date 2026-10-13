import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { GROUP_LABELS, MAX_JAIL_ATTEMPTS, PROPERTY_COLORS } from '../../lib/board';
import { playerColor } from '../../lib/colors';
import { money } from '../../lib/format';
import { netWorth, setProgress } from '../../lib/rules';
import { Countdown, TokenBadge } from './bits';

// Ten cells, one per set; fill shows how much of it the player owns, gold ring = the whole set.
function SetMatrix({ playerId, properties }) {
  const sets = setProgress(playerId, properties);
  const owned = sets.filter(s => s.owned > 0);
  const label = owned.length
    ? `Owns ${owned.map(s => `${GROUP_LABELS[s.key]} ${s.owned} of ${s.total}`).join(', ')}`
    : 'Owns no properties';
  return (
    <span className="pp-sets" role="img" aria-label={label}>
      {sets.map(s => (
        <span
          key={s.key}
          className={`pp-set${s.complete ? ' is-complete' : ''}${s.owned ? '' : ' is-empty'}`}
          style={{ '--set': PROPERTY_COLORS[s.key], '--fill': `${Math.round((s.owned / s.total) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function PlayerRow({ player, properties, isCurrent, deadline, online, isMe, onOpen }) {
  const worth = netWorth(player, properties);
  return (
    <li>
      <button
        type="button"
        className={`pp-row${isCurrent ? ' is-current' : ''}${player.is_bankrupt ? ' is-bankrupt' : ''}`}
        style={{ '--pc': playerColor(player) }}
        onClick={() => onOpen(player.id)}
        title={`Show ${player.username}'s holdings`}
      >
        <TokenBadge player={player} online={online} />
        <span className="pp-main">
          <span className="pp-name">
            {player.username}
            {isMe && <span className="pp-you">you</span>}
          </span>
          <span className="pp-badges">
            {player.is_bankrupt && <span className="g-tag g-tag--danger">Bankrupt</span>}
            {player.is_in_jail && !player.is_bankrupt && (
              <span className="g-tag g-tag--warn">Rikers {Math.min(player.jail_turns + 1, MAX_JAIL_ATTEMPTS)}/{MAX_JAIL_ATTEMPTS}</span>
            )}
            {player.get_out_of_jail_cards > 0 && (
              <span className="g-tag" title="Get Out of Jail Free cards">🎴×{player.get_out_of_jail_cards}</span>
            )}
            {isCurrent && <Countdown deadline={deadline} className="pp-countdown" />}
          </span>
          {!player.is_bankrupt && <SetMatrix playerId={player.id} properties={properties} />}
        </span>
        <span className="pp-money">
          <strong className="money">{money(player.money)}</strong>
          {!player.is_bankrupt && <span className="pp-worth">worth <span className="money">{money(worth)}</span></span>}
        </span>
      </button>
    </li>
  );
}

export default function PlayersPanel() {
  const { players, properties, presence, currentUserId, deadline, myUserId, openPlayer, status } = useGameStore(useShallow(s => ({
    players: s.players,
    properties: s.properties,
    presence: s.presence,
    currentUserId: s.game?.current_turn_user_id,
    deadline: s.game?.turn_deadline,
    status: s.game?.status,
    myUserId: s.isSpectator ? null : s.user?.id,
    openPlayer: s.openPlayer
  })));

  return (
    <div className="pp">
      <h2 className="g-pane-title">Players</h2>
      <ul className="pp-list">
        {players.map(p => (
          <PlayerRow
            key={p.id}
            player={p}
            properties={properties}
            isCurrent={status === 'in_progress' && p.user_id === currentUserId}
            deadline={deadline}
            online={presence.includes(p.user_id)}
            isMe={p.user_id === myUserId}
            onOpen={openPlayer}
          />
        ))}
      </ul>
    </div>
  );
}
