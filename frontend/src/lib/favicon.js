// The favicon is an inline SVG die; on your turn it gets a red dot. index.html carries the same plain
// icon so the first paint has it.
const ICON = '<rect x="5" y="9" width="54" height="52" rx="12" fill="#B9AE98"/><rect x="5" y="4" width="54" height="52" rx="12" fill="#FBF8F1" stroke="#1C2B24" stroke-width="3"/><circle cx="19" cy="17" r="5.5" fill="#1C2B24"/><circle cx="45" cy="17" r="5.5" fill="#1C2B24"/><circle cx="32" cy="30" r="5.5" fill="#1C2B24"/><circle cx="19" cy="43" r="5.5" fill="#1C2B24"/><circle cx="45" cy="43" r="5.5" fill="#1C2B24"/>';
const DOT = '<circle cx="50" cy="12" r="10" fill="#E5484D" stroke="#FBF8F1" stroke-width="3"/>';

export function faviconHref(withDot = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ICON}${withDot ? DOT : ''}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function setFavicon(withDot) {
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  const href = faviconHref(withDot);
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}
