import { useEffect, useId, useRef } from 'react';

/**
 * A confirmation for a destructive choice (removing a player, deleting an account, resetting the game): a
 * centred `ui-modal` <dialog> opened with showModal(), so the page behind is inert. The title states the
 * consequence, the body is plain sentences, the destructive button is the only filled stop-red one, Cancel is
 * lacquer. Focus starts on Cancel; Escape and a tap on the scrim cancel (unless it is busy), and focus goes
 * back to whatever opened it.
 *
 *   <ConfirmDialog open={!!target} title="Remove jack?" body="…" confirmLabel="Remove"
 *     busy={pending} busyLabel="Removing…" onConfirm={…} onCancel={…} />
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Working…',
  onConfirm,
  onCancel
}) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  const busyRef = useRef(busy);
  const id = useId();

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return undefined;
    const opener = document.activeElement;
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open]);

  function handleCancelEvent(event) {
    // Escape: keep the dialog under React's control.
    event.preventDefault();
    if (!busyRef.current) onCancel();
  }

  function handleClick(event) {
    // A click on the ::backdrop lands on the dialog element itself.
    if (event.target === ref.current && !busyRef.current) onCancel();
  }

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="ui-modal"
      aria-labelledby={`${id}-title`}
      aria-describedby={body ? `${id}-body` : undefined}
      onCancel={handleCancelEvent}
      onClick={handleClick}
    >
      <h2 id={`${id}-title`} className="ui-modal__title">{title}</h2>
      {body && <p id={`${id}-body`} className="ui-modal__body">{body}</p>}
      <div className="ui-modal__actions">
        <button
          type="button"
          className="ui-btn ui-btn--danger-solid"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy && <span className="ui-spinner" aria-hidden="true" />}
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" ref={cancelRef} className="ui-btn ui-btn--secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
