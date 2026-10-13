import { useId } from 'react';
import Modal from './Modal';

/** Replaces window.confirm. Cancel has focus, so Enter never confirms something destructive by accident. */
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'danger', busy = false, onConfirm, onCancel }) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId} className="g-confirm">
      <h2 id={titleId} className="g-modal-title">{title}</h2>
      {children && <div className="g-confirm-body">{children}</div>}
      <div className="g-modal-actions">
        <button type="button" className="g-btn g-btn--ghost" onClick={onCancel} autoFocus>Cancel</button>
        <button type="button" className={`g-btn g-btn--${tone}`} onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
