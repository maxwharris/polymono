import { useId } from 'react';
import Modal from './Modal';
import { Spinner } from './bits';

/**
 * Replaces window.confirm. The title states the consequence ("Declare bankruptcy?"), the body is plain
 * sentences, the destructive button is the only filled stop-red button in the app (tone 'primary' makes it
 * brass for a confirmation that is not destructive). Cancel has focus (data-autofocus, see Modal), so Enter
 * never confirms by accident.
 */
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'danger', busy = false, onConfirm, onCancel }) {
  const titleId = useId();
  const confirmClass = tone === 'danger' ? 'ui-btn--danger-solid' : 'ui-btn--primary';
  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId} className="g-confirm">
      <h2 id={titleId} className="ui-modal__title">{title}</h2>
      {children && <div className="ui-modal__body g-confirm__body">{children}</div>}
      <div className="ui-modal__actions">
        <button type="button" className={`ui-btn ${confirmClass}`} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {confirmLabel}
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onCancel} data-autofocus>Cancel</button>
      </div>
    </Modal>
  );
}
