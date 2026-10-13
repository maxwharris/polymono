/**
 * Phone alerts through ntfy (https://ntfy.sh). Each player who turns alerts on gets a random, unguessable
 * topic and subscribes to it in the ntfy app. Messages carry no hostnames or game secrets beyond the text.
 */

const crypto = require('crypto');

const NTFY_BASE = process.env.NTFY_BASE || 'https://ntfy.sh';
const SITE_URL = process.env.SITE_URL || 'https://mp.maxharris.io';

function newTopic() {
  return `polymono-${crypto.randomBytes(12).toString('base64url')}`;
}

function subscribeUrl(topic) {
  return `${NTFY_BASE}/${topic}`;
}

async function sendAlert(topic, message) {
  try {
    const res = await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      headers: { Title: 'Polymono', Click: SITE_URL },
      body: message,
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) console.error(`ntfy answered ${res.status}`);
  } catch (err) {
    console.error('ntfy send failed:', err.message);
  }
}

module.exports = { newTopic, subscribeUrl, sendAlert };
