import { useEffect, useRef } from 'react';
import './ui.css';

const SUPPORTS_CLOSEDBY = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/**
 * A native modal <dialog> (top layer, focus trap, Esc) driven by `open`. `onClose` runs however it closes:
 * Esc, a tap on the scrim (closedby="any", with a fallback for Safari) or open becoming false.
 * variant 'center' is a centred dialog at every width (ui-modal: confirmations); 'sheet' is a bottom sheet on
 * phones with a grabber and a centred 560px dialog from 900px (ui-sheet). Children only render while open.
 *
 * Initial focus: mark the harmless control with `data-autofocus` (Cancel, OK, Close). React's autoFocus does
 * not work here: it focuses on mount, then showModal() moves focus to the first focusable control, which in a
 * confirmation is the destructive one. Without a mark, the browser's choice (the first control) stands.
 */
export default function Modal({ open, onClose, labelledBy, label, variant = 'center', dismissible = true, className = '', children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel(event) {
    if (!dismissible) event.preventDefault();
  }

  // Light dismiss for browsers without closedby: a click whose target is the dialog itself and that lands
  // outside its box hit the backdrop.
  function handleClick(event) {
    if (!dismissible || SUPPORTS_CLOSEDBY || event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) event.currentTarget.close();
  }

  const sheet = variant === 'sheet';
  return (
    <dialog
      ref={ref}
      className={`${sheet ? 'ui-sheet g-sheet' : 'ui-modal g-dialog'} ${className}`}
      closedby={dismissible ? 'any' : 'none'}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onClose={onClose}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      {open && sheet && <div className="ui-sheet__grab" aria-hidden="true" />}
      {open ? children : null}
    </dialog>
  );
}
