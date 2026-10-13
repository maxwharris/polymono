import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import './ui.css';

const VISIBLE = 3;
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

function modalIsOpen() {
  try {
    return !!document.querySelector('dialog:modal');
  } catch {
    return false;
  }
}

function Toast({ toast, onDismiss }) {
  const { id, ttl } = toast;

  useEffect(() => {
    if (ttl == null) return undefined;
    const timer = setTimeout(() => onDismiss(id), ttl);
    return () => clearTimeout(timer);
  }, [id, ttl, onDismiss]);

  return (
    <div className={`g-toast g-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      {toast.icon && <span className="g-toast-icon" aria-hidden="true">{toast.icon}</span>}
      <div className="g-toast-text">
        <p className="g-toast-title">{toast.title}</p>
        {toast.body && <p className="g-toast-body">{toast.body}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="g-toast-action"
          onClick={() => {
            toast.action.run();
            onDismiss(id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="g-toast-close" aria-label="Dismiss" onClick={() => onDismiss(id)}>×</button>
    </div>
  );
}

/**
 * Up to three toasts: top-right on desktop, under the top bar on phones. The stack is a manual popover so
 * it sits in the top layer, above any open modal dialog.
 */
export default function Toaster() {
  const { toasts, dismissToast } = useGameStore(useShallow(s => ({ toasts: s.toasts, dismissToast: s.dismissToast })));
  const ref = useRef(null);
  const visible = toasts.slice(-VISIBLE);
  const count = visible.length;
  const newest = count ? visible[count - 1].id : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || !SUPPORTS_POPOVER) return;
    const isOpen = el.matches(':popover-open');
    if (!count) {
      if (isOpen) el.hidePopover();
      return;
    }
    // A dialog opened after the stack covers it; showing it again puts it back on top.
    if (isOpen && modalIsOpen()) el.hidePopover();
    if (!el.matches(':popover-open')) el.showPopover();
  }, [count, newest]);

  return (
    <section
      ref={ref}
      className="g-toaster"
      popover={SUPPORTS_POPOVER ? 'manual' : undefined}
      aria-label="Notifications"
    >
      {visible.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
    </section>
  );
}
