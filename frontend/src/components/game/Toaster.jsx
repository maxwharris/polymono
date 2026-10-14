import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../../store/gameStore';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import './ui.css';

const VISIBLE = 3;
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
const TONE_ICONS = { success: 'check', error: 'warning', warn: 'info', info: 'info' };

function modalIsOpen() {
  try {
    return !!document.querySelector('dialog:modal');
  } catch {
    return false;
  }
}

function ids(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isInteger);
  try {
    return typeof value === 'string' ? ids(JSON.parse(value)) : [];
  } catch {
    return [];
  }
}

/** "Upper West Side for your Hell's Kitchen and $60": an offer to me, in one plain sentence. */
function describeOffer(state, tradeId) {
  const trade = state.trades?.active?.find(t => t.id === tradeId);
  if (!trade) return null;
  const name = id => state.properties.find(p => p.id === id)?.name;
  const side = (which) => {
    const parts = ids(trade[`${which}_properties`]).map(name).filter(Boolean);
    if (Number(trade[`${which}_money`])) parts.push(money(trade[`${which}_money`]));
    const cards = Number(trade[`${which}_jail_cards`]) || 0;
    if (cards) parts.push(cards === 1 ? 'a free card' : `${cards} free cards`);
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
  };
  const gives = side('offered');
  const wants = side('requested');
  if (gives && wants) return `${gives} for your ${wants}`;
  if (gives) return `${gives}, asking nothing back`;
  return wants ? `They ask for your ${wants}` : null;
}

function Toast({ toast, onDismiss }) {
  const { id, ttl } = toast;
  const actor = useGameStore(s => (toast.actor != null ? s.players.find(p => p.user_id === toast.actor) ?? null : null));
  const offer = useGameStore(s => (toast.tradeId ? describeOffer(s, toast.tradeId) : null));

  useEffect(() => {
    if (ttl == null) return undefined;
    const timer = setTimeout(() => onDismiss(id), ttl);
    return () => clearTimeout(timer);
  }, [id, ttl, onDismiss]);

  const body = toast.body || offer;
  return (
    <div className={`ui-toast g-toast${toast.tone === 'error' ? ' ui-toast--error' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      {actor
        ? <Medallion player={actor} size={36} />
        : <span className={`g-toast__icon is-${toast.tone}`} aria-hidden="true"><Icon name={toast.icon || TONE_ICONS[toast.tone] || 'info'} size={20} /></span>}
      <div className="g-toast__text">
        <p className="ui-toast__title">{toast.title}</p>
        {body && <p className="ui-toast__body">{body}</p>}
      </div>
      <button type="button" className="ui-btn ui-btn--icon ui-btn--ghost ui-toast__close" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <Icon name="close" size={20} />
      </button>
      {toast.action && (
        <div className="ui-toast__actions">
          <button
            type="button"
            className="ui-btn ui-btn--tint"
            onClick={() => {
              toast.action.run();
              onDismiss(id);
            }}
          >
            {toast.action.label}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Up to three toasts: under the top bar on phones, top right (360 wide) on desktop. The stack is a manual
 * popover so it sits in the top layer, above any open modal dialog.
 */
export default function Toaster() {
  const { toasts, dismissToast, offline } = useGameStore(useShallow(s => ({ toasts: s.toasts, dismissToast: s.dismissToast, offline: !!s.token && !s.connected })));
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
    <section ref={ref} className={`g-toaster${offline ? ' g-toaster--low' : ''}`} popover={SUPPORTS_POPOVER ? 'manual' : undefined} aria-label="Notifications">
      {visible.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
    </section>
  );
}
