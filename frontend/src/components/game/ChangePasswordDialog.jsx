import { useId, useState } from 'react';
import useGameStore from '../../store/gameStore';
import Icon from '../ui/Icon';
import Modal from './Modal';
import { Spinner } from './bits';

function PasswordField({ id, label, value, onChange, autoComplete, describedBy }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={id}>{label}</label>
      <span className="ui-input">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-describedby={describedBy}
          required
        />
        <button type="button" className="ui-input__act" aria-pressed={shown} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setShown(s => !s)}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </span>
    </div>
  );
}

export default function ChangePasswordDialog({ open, onClose }) {
  const changePassword = useGameStore(s => s.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const ids = { current: useId(), next: useId(), confirm: useId(), error: useId(), hint: useId() };

  function close() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (next.length < 6) return setError('The new password needs at least 6 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setSaving(true);
    setError('');
    try {
      await changePassword(current, next);
      close();
    } catch (err) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy={titleId} variant="sheet" className="pw">
      <form onSubmit={handleSubmit} className="pw__form" noValidate>
        <div className="ui-sheet__head">
          <h2 id={titleId} className="ui-sheet__title">Change password</h2>
        </div>
        <PasswordField id={ids.current} label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id={ids.next} label="New password" value={next} onChange={setNext} autoComplete="new-password" describedBy={`${ids.hint}${error ? ` ${ids.error}` : ''}`} />
        <p id={ids.hint} className="ui-hint">At least 6 characters. Your other devices will need to log in again.</p>
        <PasswordField id={ids.confirm} label="New password again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p id={ids.error} className="ui-error" role="alert"><Icon name="warning" size={18} />{error}</p>}
        <div className="ui-sheet__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || !current || !next || !confirm} aria-busy={saving || undefined}>
            {saving && <Spinner />}
            {saving ? 'Saving…' : 'Change password'}
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
