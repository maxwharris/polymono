// A deploy replaces every hashed chunk, so a tab opened before it fails to import the Board (and three.js)
// later: the old files are gone and nginx answers them with index.html. Only a reload fixes that.

const KEY = 'polymono:reloadedAt';
const GUARD_MS = 60 * 1000;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /dynamically imported module|Importing a module script failed|module script|MIME type|Unable to preload CSS/i.test(message);
}

/**
 * Reloads the page to pick up the new build. Returns false without reloading when offline, or when it already
 * reloaded for this a moment ago (the new build is broken too: don't loop).
 */
export function reloadForNewBuild() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage, so no loop guard: leave it to the Reload button
  }
  window.location.reload();
  return true;
}
