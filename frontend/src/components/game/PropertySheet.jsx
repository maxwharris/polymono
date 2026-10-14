import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { SPACES } from '../../lib/board';
import Icon from '../ui/Icon';
import { PlayerChip } from './bits';
import ManageControls from './ManageControls';
import Modal from './Modal';
import PropertyCard, { SpaceCard } from './PropertyCard';
import './sheets.css';

/**
 * The space the Board (or a list) asked for via openProperty(position): a title deed or a special space,
 * who is standing there, and what you can do about it. Close, a tap on the scrim and Esc all close it.
 */
export default function PropertySheet() {
  const { position, property, players, closeProperty, openTrade, gameActive } = useGameStore(useShallow(s => ({
    position: s.selectedPosition,
    property: s.selectedPosition == null ? null : s.properties.find(p => p.position_on_board === s.selectedPosition) || null,
    players: s.players,
    closeProperty: s.closeProperty,
    openTrade: s.openTrade,
    gameActive: s.game?.status === 'in_progress'
  })));
  const me = useGameStore(selectMyPlayer);
  const titleId = useId();

  const open = position != null && !!SPACES[position];
  const here = open ? players.filter(p => p.position === position && !p.is_bankrupt) : [];
  const owner = property?.owner_id != null ? players.find(p => p.id === property.owner_id) : null;
  const isMine = !!me && !!owner && owner.id === me.id;
  const canTrade = gameActive && !!me && !me.is_bankrupt && !!owner && !isMine && !owner.is_bankrupt;

  return (
    <Modal open={open} onClose={closeProperty} labelledBy={property ? undefined : titleId} label={property ? `${property.name}, title deed` : undefined} variant="sheet" className="psheet">
      {open && (
        <>
          <div className="psheet__card">
            {property ? <PropertyCard property={property} variant="full" /> : <SpaceCard position={position} titleId={titleId} />}
          </div>
          {isMine && gameActive && !me.is_bankrupt && (
            <section className="psheet__manage" aria-label="Manage">
              <h3 className="psheet__h">Manage</h3>
              <ManageControls property={property} showBuildReason />
            </section>
          )}
          {here.length > 0 && (
            <div className="psheet__here">
              <Icon name="pin" size={18} />
              <span className="psheet__here-label">Here now</span>
              {here.map(p => <PlayerChip key={p.id} player={p} you={p.id === me?.id} />)}
            </div>
          )}
          <div className="ui-sheet__actions psheet__actions">
            {canTrade && (
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => openTrade({ recipientPlayerId: owner.id, requestedProperties: [property.id] })}
              >
                <Icon name="trade" size={20} />
                Ask {owner.username} for it
              </button>
            )}
            <button type="button" className="ui-btn ui-btn--ghost" onClick={closeProperty} data-autofocus>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
