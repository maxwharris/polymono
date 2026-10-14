import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api';
import Icon from '../ui/Icon';
import Modal from './Modal';
import { Spinner } from './bits';

const PHONE_HELP = 'https://docs.ntfy.sh/subscribe/phone/';

function ntfyLink(topic, subscribeUrl) {
  let host = 'ntfy.sh';
  try {
    if (subscribeUrl) host = new URL(subscribeUrl).host || host;
  } catch {
    // keep ntfy.sh
  }
  return `ntfy://${host}/${topic}`;
}

/** The dialog's content: mounted only while open, so every opening loads fresh settings. */
function AlertsBody({ titleId, onClose }) {
  const [settings, setSettings] = useState(null); // { enabled, topic, subscribeUrl }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // 'toggle' | 'test'
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const switchId = useId();

  useEffect(() => {
    let live = true;
    api('/auth/alerts')
      .then(data => { if (live) setSettings(data); })
      .catch(err => { if (live) setError(err.message || 'Could not load your alert settings.'); });
    return () => { live = false; };
  }, []);

  async function toggle() {
    if (!settings || busy) return;
    setBusy('toggle');
    setError('');
    setNote('');
    try {
      setSettings(await api('/auth/alerts', { method: 'POST', body: { enabled: !settings.enabled } }));
    } catch (err) {
      setError(err.message || 'Could not change your alerts.');
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy('test');
    setError('');
    setNote('');
    try {
      await api('/auth/alerts/test', { method: 'POST' });
      setNote('Sent. It should arrive within a few seconds.');
    } catch (err) {
      setError(err.message || 'The test alert did not go out.');
    } finally {
      setBusy(null);
    }
  }

  async function copyTopic() {
    try {
      await navigator.clipboard.writeText(settings.topic);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const enabled = !!settings?.enabled;

  return (
    <>
      <div className="ui-sheet__head">
        <h2 id={titleId} className="ui-sheet__title">Turn alerts</h2>
      </div>
      <p className="alerts__lead">
        Get a notification on your phone when it is your turn, when someone sends you an offer and when you owe money,
        even while Polymono is closed.
      </p>

      <div className="alerts__switch">
        <label htmlFor={switchId} className="alerts__switch-label">
          <Icon name="bell" />
          <span>
            Turn alerts
            <small>{settings == null && !error ? 'Loading…' : enabled ? 'On' : 'Off'}</small>
          </span>
        </label>
        {busy === 'toggle' && <Spinner />}
        <button
          id={switchId}
          type="button"
          role="switch"
          className="ui-switch"
          aria-checked={enabled}
          disabled={settings == null || busy != null}
          onClick={toggle}
        >
          <span className="sr-only">Turn alerts</span>
        </button>
      </div>

      {enabled && (
        <section className="alerts__how" aria-label="How to subscribe">
          <h3 className="alerts__h">Subscribe on your phone</h3>
          <ol className="alerts__steps">
            <li>
              <span className="alerts__n" aria-hidden="true">1</span>
              <span>
                Install the free <a href={PHONE_HELP} target="_blank" rel="noreferrer">ntfy app</a> on your phone.
              </span>
            </li>
            <li>
              <span className="alerts__n" aria-hidden="true">2</span>
              <span>
                Subscribe to your private topic. Keep it to yourself: anyone with it can read your alerts.
                <span className="alerts__topic">
                  <code>{settings.topic}</code>
                  <button type="button" className="ui-btn ui-btn--tint ui-btn--sm" onClick={copyTopic}>
                    {copied && <Icon name="check" size={18} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </span>
              </span>
            </li>
            <li>
              <span className="alerts__n" aria-hidden="true">3</span>
              <span>
                Or open it straight in the app, or in the browser.
                <span className="alerts__links">
                  <a className="ui-btn ui-btn--secondary ui-btn--sm" href={ntfyLink(settings.topic, settings.subscribeUrl)}>
                    <Icon name="bell" size={18} />
                    Open in ntfy
                  </a>
                  {settings.subscribeUrl && (
                    <a className="ui-btn ui-btn--ghost ui-btn--sm" href={settings.subscribeUrl} target="_blank" rel="noreferrer">
                      {settings.subscribeUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </span>
              </span>
            </li>
          </ol>
          <p className="ui-hint">Alerts only go out while you are away from Polymono. Turning alerts off and on again gives you a new topic.</p>
        </section>
      )}

      {error && <p className="ui-error alerts__msg" role="alert"><Icon name="warning" size={18} />{error}</p>}
      {note && <p className="ui-well ui-well--brass alerts__msg" role="status"><Icon name="check" size={18} />{note}</p>}

      <div className="ui-sheet__actions">
        {enabled && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={sendTest} disabled={busy != null} aria-busy={busy === 'test' || undefined}>
            {busy === 'test' ? <Spinner /> : <Icon name="send" size={20} />}
            Send a test alert
          </button>
        )}
        <button type="button" className={`ui-btn ${enabled ? 'ui-btn--ghost' : 'ui-btn--secondary'}`} onClick={onClose}>Done</button>
      </div>
    </>
  );
}

/** "Turn alerts" from the account menu: ntfy phone notifications (GET/POST /api/auth/alerts). */
export default function AlertsDialog({ open, onClose }) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} variant="sheet" className="alerts">
      <AlertsBody titleId={titleId} onClose={onClose} />
    </Modal>
  );
}
