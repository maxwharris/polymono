import { useEffect, useId, useRef } from 'react';
import ui from './ui.module.css';

/**
 * An inline "are you sure?" step for a choice that is not destructive (accepting a trade). Render it in
 * place of the button that asked for it. Focus lands on Cancel (the safe choice) and Escape cancels.
 * Destructive confirmations (removing a player, deleting an account) use ConfirmDialog instead.
 */
export default function ConfirmStep({
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  busyLabel = 'Working…',
  onConfirm,
  onCancel
}) {
  const cancelRef = useRef(null);
  const id = useId();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onCancel();
    }
  }

  const danger = tone === 'danger';

  return (
    <div
      className={`${ui.confirm} ${danger ? '' : ui.confirmPrimary}`}
      role="group"
      aria-labelledby={`${id}-msg`}
      aria-describedby={detail ? `${id}-detail` : undefined}
      onKeyDown={onKeyDown}
    >
      <p id={`${id}-msg`} className={ui.confirmMessage}>{message}</p>
      {detail && <p id={`${id}-detail`} className={ui.confirmDetail}>{detail}</p>}
      <div className={ui.confirmActions}>
        <button
          type="button"
          className={`ui-btn ${danger ? 'ui-btn--danger-solid' : 'ui-btn--primary'}`}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy && <span className="ui-spinner" aria-hidden="true" />}
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" ref={cancelRef} className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
