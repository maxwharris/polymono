import { useEffect, useRef } from 'react';
import './ui.css';

const SUPPORTS_CLOSEDBY = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/**
 * A native modal <dialog> (top layer, focus trap, Esc) driven by `open`. `onClose` runs however it closes:
 * Esc, a tap on the backdrop (closedby="any", with a fallback for Safari) or open becoming false.
 * variant 'center' is a centred card; 'sheet' is a bottom sheet on phones and a centred card on desktop.
 * Children only render while open.
 */
export default function Modal({ open, onClose, labelledBy, label, variant = 'center', dismissible = true, className = '', children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
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

  return (
    <dialog
      ref={ref}
      className={`g-modal g-modal--${variant} ${className}`}
      closedby={dismissible ? 'any' : 'none'}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onClose={onClose}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      {open ? children : null}
    </dialog>
  );
}
