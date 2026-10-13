export function money(amount) {
  const n = Number(amount) || 0;
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`;
}

// "3h 12m", "45m", "overdue"
export function timeLeft(deadline, now = Date.now()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'overdue';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// "+$200" / "-$50"
export function signedMoney(amount) {
  const n = Number(amount) || 0;
  return `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// "just now", "5m ago", "3h ago", "2d ago"
export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return '';
  const ms = now - new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
