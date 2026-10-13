import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { GROUP_LABELS, MAX_JAIL_ATTEMPTS, PROPERTY_COLORS } from '../../lib/board';
import { playerColor } from '../../lib/colors';
import { money, plural } from '../../lib/format';
import { tokenLabel } from '../../lib/tokens';
import { groupHoldings, netWorth } from '../../lib/rules';
import { TokenBadge } from './bits';
import Modal from './Modal';
import PropertyCard from './PropertyCard';

/** A player's holdings: cash, net worth, jail status and every property by set. */
export default function PlayerSheet() {
  const { player, properties, online, openProperty, openTrade, closePlayer, gameActive } = useGameStore(useShallow(s => ({
    player: s.players.find(p => p.id === s.playerSheetId) || null,
    properties: s.properties,
    online: s.presence,
    openProperty: s.openProperty,
    openTrade: s.openTrade,
    closePlayer: s.closePlayer,
    gameActive: s.game?.status === 'in_progress'
  })));
  const me = useGameStore(selectMyPlayer);
  const titleId = useId();

  const open = !!player;
  const groups = player ? groupHoldings(player.id, properties) : [];
  const isMe = !!player && !!me && player.id === me.id;
  const canTrade = !!player && !!me && !isMe && gameActive && !me.is_bankrupt && !player.is_bankrupt;

  return (
    <Modal open={open} onClose={closePlayer} labelledBy={titleId} variant="sheet" className="ps">
      {player && (
        <>
          <header className="g-modal-head" style={{ '--pc': playerColor(player) }}>
            <TokenBadge player={player} size="lg" online={online.includes(player.user_id)} />
            <div>
              <h2 id={titleId} className="g-modal-title">{player.username}{isMe ? ' (you)' : ''}</h2>
              <p className="g-modal-sub">{tokenLabel(player.token_type)}</p>
            </div>
            <button type="button" className="g-icon-btn" aria-label="Close" onClick={closePlayer}>×</button>
          </header>
          <dl className="ps-stats">
            <div><dt>Cash</dt><dd className="money">{money(player.money)}</dd></div>
            <div><dt>Net worth</dt><dd className="money">{money(netWorth(player, properties))}</dd></div>
            <div><dt>Properties</dt><dd>{groups.reduce((n, g) => n + g.owned, 0)}</dd></div>
          </dl>
          <div className="ps-tags">
            {player.is_bankrupt && <span className="g-tag g-tag--danger">Bankrupt</span>}
            {player.is_in_jail && <span className="g-tag g-tag--warn">In Rikers, attempt {Math.min(player.jail_turns + 1, MAX_JAIL_ATTEMPTS)} of {MAX_JAIL_ATTEMPTS}</span>}
            {player.get_out_of_jail_cards > 0 && <span className="g-tag">🎴 {plural(player.get_out_of_jail_cards, 'Get Out of Jail Free card')}</span>}
          </div>
          {groups.length === 0 ? (
            <p className="g-empty">{player.is_bankrupt ? 'Nothing left.' : 'No properties yet.'}</p>
          ) : (
            <div className="ps-groups">
              {groups.map(g => (
                <section key={g.key} className="ps-group" style={{ '--set': PROPERTY_COLORS[g.key] }}>
                  <h3 className="ps-group-title">
                    <span className="g-swatch" aria-hidden="true" />
                    {GROUP_LABELS[g.key]}
                    <span className={`ps-count${g.complete ? ' is-complete' : ''}`}>{g.complete ? 'Full set' : `${g.owned} of ${g.total}`}</span>
                  </h3>
                  <ul>
                    {g.items.map(p => (
                      <li key={p.id}>
                        <button type="button" className="ps-item" onClick={() => { closePlayer(); openProperty(p.position_on_board); }}>
                          <PropertyCard property={p} variant="row" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div className="g-modal-actions">
            {canTrade && (
              <button type="button" className="g-btn g-btn--primary" onClick={() => openTrade({ recipientPlayerId: player.id })}>
                Propose a trade
              </button>
            )}
            <button type="button" className="g-btn g-btn--ghost" onClick={closePlayer}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
