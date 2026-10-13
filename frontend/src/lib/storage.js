// localStorage that never throws (private mode, blocked storage, quota): reads fall back to null.

export function readItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable: the preference just won't survive a reload
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}

export function readJSON(key) {
  const raw = readItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJSON(key, value) {
  writeItem(key, JSON.stringify(value));
}

// A positive integer, or null.
export function readId(key) {
  const n = Number(readItem(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}
