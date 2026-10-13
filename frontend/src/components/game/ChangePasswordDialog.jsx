import { useId, useState } from 'react';
import useGameStore from '../../store/gameStore';
import Modal from './Modal';

export default function ChangePasswordDialog({ open, onClose }) {
  const changePassword = useGameStore(s => s.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const ids = { current: useId(), next: useId(), confirm: useId(), error: useId() };

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
    <Modal open={open} onClose={close} labelledBy={titleId} className="pw">
      <form onSubmit={handleSubmit} className="g-form" noValidate>
        <h2 id={titleId} className="g-modal-title">Change password</h2>
        <label htmlFor={ids.current}>Current password</label>
        <input id={ids.current} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
        <label htmlFor={ids.next}>New password</label>
        <input id={ids.next} type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} minLength={6} required aria-describedby={error ? ids.error : undefined} />
        <label htmlFor={ids.confirm}>New password again</label>
        <input id={ids.confirm} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <p id={ids.error} className="g-form-error" role="alert">{error}</p>}
        <div className="g-modal-actions">
          <button type="button" className="g-btn g-btn--ghost" onClick={close}>Cancel</button>
          <button type="submit" className="g-btn g-btn--primary" disabled={saving || !current || !next}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
