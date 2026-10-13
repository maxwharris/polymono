import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { SPACES, describeSpace } from '../../lib/board';
import { PlayerChip } from './bits';
import ManageControls from './ManageControls';
import Modal from './Modal';
import PropertyCard from './PropertyCard';

const SPACE_ICONS = { go: '🎆', community: '🎁', chance: '❓', tax: '🧾', jail: '🚔', free: '🧳', gotojail: '🚓' };

/** The space the Board (or a list) asked for via openProperty(position): a title deed or a special space. */
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
  const space = open ? SPACES[position] : null;
  const here = open ? players.filter(p => p.position === position && !p.is_bankrupt) : [];
  const owner = property?.owner_id != null ? players.find(p => p.id === property.owner_id) : null;
  const isMine = !!me && !!owner && owner.id === me.id;
  const canTrade = gameActive && !!me && !me.is_bankrupt && !!owner && !isMine && !owner.is_bankrupt;

  return (
    <Modal open={open} onClose={closeProperty} labelledBy={property ? undefined : titleId} label={property?.name} variant="sheet" className="psheet">
      {open && (
        <>
          <button type="button" className="g-icon-btn psheet-close" aria-label="Close" onClick={closeProperty}>×</button>
          {property ? (
            <PropertyCard property={property} variant="full" />
          ) : (
            <article className="space-card">
              <span className="space-icon" aria-hidden="true">{SPACE_ICONS[space.kind] || '⬜'}</span>
              <h2 id={titleId} className="space-name">{space.name}</h2>
              <p className="space-text">{describeSpace(position)}</p>
            </article>
          )}
          {isMine && gameActive && !me.is_bankrupt && (
            <div className="psheet-manage">
              <h3 className="g-subtitle">Manage</h3>
              <ManageControls property={property} showBuildReason />
            </div>
          )}
          {here.length > 0 && (
            <p className="psheet-here">
              <span>Here now:</span>
              {here.map(p => <PlayerChip key={p.id} player={p} you={p.id === me?.id} />)}
            </p>
          )}
          <div className="g-modal-actions">
            {canTrade && (
              <button
                type="button"
                className="g-btn g-btn--primary"
                onClick={() => openTrade({ recipientPlayerId: owner.id, requestedProperties: [property.id] })}
              >
                Ask {owner.username} for it
              </button>
            )}
            <button type="button" className="g-btn g-btn--ghost" onClick={closeProperty}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
