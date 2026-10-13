// Date labels for a game played over days: "4:05 PM" today, "Yesterday 9:12 AM", "Mon 4:05 PM", "Oct 3".

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function clockTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
}

// "Today", "Yesterday", "Monday", "Oct 3" or "Oct 3, 2025".
export function dayLabel(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

// A compact timestamp for lists: the time today, the day and time this week, the date before that.
export function shortWhen(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return clockTime(date);
  if (days === 1) return `Yesterday ${clockTime(date)}`;
  if (days > 1 && days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${clockTime(date)}`;
  return dayLabel(date, now);
}

export function dayKey(value) {
  const date = toDate(value);
  return date ? date.toDateString() : '';
}

export function isoString(value) {
  const date = toDate(value);
  return date ? date.toISOString() : undefined;
}
