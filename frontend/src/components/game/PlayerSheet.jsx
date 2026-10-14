import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { GROUP_LABELS, MAX_JAIL_ATTEMPTS, PROPERTY_COLORS } from '../../lib/board';
import { money } from '../../lib/format';
import { tokenLabel } from '../../lib/tokens';
import { groupHoldings, netWorth } from '../../lib/rules';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import { Swatch } from './bits';
import Modal from './Modal';
import PropertyCard from './PropertyCard';
import './sheets.css';

/** A player's holdings: cash, net worth, jail status and every property by set. */
export default function PlayerSheet() {
  const { player, properties, online, openProperty, openTrade, closePlayer, gameActive, currentUserId } = useGameStore(useShallow(s => ({
    player: s.players.find(p => p.id === s.playerSheetId) || null,
    properties: s.properties,
    online: s.presence,
    openProperty: s.openProperty,
    openTrade: s.openTrade,
    closePlayer: s.closePlayer,
    gameActive: s.game?.status === 'in_progress',
    currentUserId: s.game?.current_turn_user_id
  })));
  const me = useGameStore(selectMyPlayer);
  const titleId = useId();

  const open = !!player;
  const groups = player ? groupHoldings(player.id, properties) : [];
  const isMe = !!player && !!me && player.id === me.id;
  const canTrade = !!player && !!me && !isMe && gameActive && !me.is_bankrupt && !player.is_bankrupt;
  const isOnline = !!player && online.includes(player.user_id);
  const count = groups.reduce((n, g) => n + g.owned, 0);

  return (
    <Modal open={open} onClose={closePlayer} labelledBy={titleId} variant="sheet" className="psheet psheet--player">
      {player && (
        <>
          <header className="ps__head">
            <Medallion player={player} size={48} online={isOnline} current={gameActive && player.user_id === currentUserId} />
            <div className="ps__who">
              <h2 id={titleId} className="ui-sheet__title">{player.username}{isMe && <span className="ui-tag ps__you">you</span>}</h2>
              <p className="ps__sub">{tokenLabel(player.token_type)}{isOnline ? ', online now' : ''}</p>
            </div>
          </header>
          <dl className="ps__stats">
            <div><dt>Cash</dt><dd className="ui-money">{money(player.money)}</dd></div>
            <div><dt>Worth</dt><dd className="ui-money">{money(netWorth(player, properties))}</dd></div>
            <div><dt>Properties</dt><dd className="ui-money">{count}</dd></div>
          </dl>
          {(player.is_bankrupt || player.is_in_jail || player.get_out_of_jail_cards > 0) && (
            <p className="ps__tags">
              {player.is_bankrupt && <span className="ui-tag ui-tag--stop"><Icon name="close" size={14} />Bankrupt</span>}
              {player.is_in_jail && !player.is_bankrupt && (
                <span className="ui-tag ui-tag--quiet"><Icon name="bars" size={14} />In Rikers, attempt {Math.min(player.jail_turns + 1, MAX_JAIL_ATTEMPTS)} of {MAX_JAIL_ATTEMPTS}</span>
              )}
              {player.get_out_of_jail_cards > 0 && (
                <span className="ui-tag"><Icon name="card" size={14} />{player.get_out_of_jail_cards === 1 ? 'A free card' : `${player.get_out_of_jail_cards} free cards`}</span>
              )}
            </p>
          )}
          {groups.length === 0 ? (
            <p className="ps__empty">{player.is_bankrupt ? 'Nothing left.' : 'No properties yet.'}</p>
          ) : (
            <div className="ps__groups">
              {groups.map(g => (
                <section key={g.key} className="ps__group" aria-label={GROUP_LABELS[g.key]}>
                  <h3 className="mine__group-title">
                    <Swatch color={PROPERTY_COLORS[g.key]} />
                    {GROUP_LABELS[g.key]}
                    <span className={`mine__count${g.complete ? ' is-full' : ''}`}>
                      {g.complete ? <><Icon name="check" size={14} />Full set</> : `${g.owned} of ${g.total}`}
                    </span>
                  </h3>
                  <ul className="ps__list">
                    {g.items.map(p => (
                      <li key={p.id}>
                        <button type="button" className="ps__item" onClick={() => { closePlayer(); openProperty(p.position_on_board); }}>
                          <PropertyCard property={p} variant="row" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div className="ui-sheet__actions">
            {canTrade && (
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => openTrade({ recipientPlayerId: player.id })}>
                <Icon name="trade" size={20} />
                Propose a trade
              </button>
            )}
            <button type="button" className="ui-btn ui-btn--ghost" onClick={closePlayer}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
