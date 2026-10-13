import { useEffect, useId, useRef } from 'react';
import ui from './ui.module.css';

/**
 * An inline "are you sure?" step that replaces window.confirm. Render it in place of the button that
 * asked for it. Focus lands on Cancel (the safe choice) and Escape cancels.
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

  const confirmClass = tone === 'danger' ? ui.danger : ui.primary;

  return (
    <div
      className={`${ui.confirm} ${tone === 'danger' ? '' : ui.confirmPrimary}`}
      role="group"
      aria-labelledby={`${id}-msg`}
      aria-describedby={detail ? `${id}-detail` : undefined}
      onKeyDown={onKeyDown}
    >
      <p id={`${id}-msg`} className={ui.confirmMessage}>{message}</p>
      {detail && <p id={`${id}-detail`} className={ui.confirmDetail}>{detail}</p>}
      <div className={ui.confirmActions}>
        <button type="button" className={`${ui.btn} ${confirmClass}`} onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" ref={cancelRef} className={`${ui.btn} ${ui.ghost}`} onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
