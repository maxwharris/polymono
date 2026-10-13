// The Midnight Deco line-icon set: a 24px grid, 1.75px stroke, round caps and joins, currentColor,
// square-leaning geometry. Render with <Icon name="…" /> (Icon.jsx). Filled details (pips, dots) set
// fill="currentColor" stroke="none" themselves.
const dot = (cx, cy, r = 1.25) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

export const ICONS = {
  // ---- navigation (tab bar, panes) ----
  board: <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><rect x="8" y="8" width="8" height="8" rx=".75" /><path d="M8 3.5V8M16 3.5V8M8 16v4.5M16 16v4.5M3.5 8H8M3.5 16H8M16 8h4.5M16 16h4.5" /></>,
  players: <><circle cx="9" cy="8.5" r="3.25" /><path d="M3.25 19.5c.5-3.3 2.8-5.25 5.75-5.25s5.25 1.95 5.75 5.25" /><path d="M15.25 5.6a3 3 0 1 1 0 5.8M17.5 14.3c2 .5 3.3 2.2 3.6 5.2" /></>,
  activity: <><path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h7" /><rect x="3.5" y="5" width="3" height="3" rx=".4" fill="currentColor" stroke="none" /><rect x="3.5" y="10.5" width="3" height="3" rx=".4" fill="currentColor" stroke="none" /><rect x="3.5" y="16" width="3" height="3" rx=".4" fill="currentColor" stroke="none" /></>,
  chat: <path d="M3.75 5.25h16.5v10.5h-8.5l-4.5 3.5v-3.5h-3.5z" />,
  deed: <><rect x="5" y="3.25" width="14" height="17.5" rx="1.5" /><path d="M5 8.25h14M8.5 12.25h7M8.5 15.75h4.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <>{dot(6, 12, 1.5)}{dot(12, 12, 1.5)}{dot(18, 12, 1.5)}</>,

  // ---- game actions ----
  dice: <><rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3.5" />{dot(8.6, 8.6)}{dot(12, 12)}{dot(15.4, 15.4)}</>,
  roll: <><rect x="2.75" y="8.75" width="11.5" height="11.5" rx="2.5" />{dot(6.2, 12.2, 1.1)}{dot(10.8, 16.8, 1.1)}<path d="M10.2 5.9 15.9 4.4a2.5 2.5 0 0 1 3.06 1.77l1.68 6.27a2.5 2.5 0 0 1-1.77 3.06L17 16" />{dot(15.6, 9.4, 1.1)}</>,
  buy: <><path d="M3.75 12.6V4.75a1 1 0 0 1 1-1h7.85l7.9 7.9a1 1 0 0 1 0 1.41l-7.5 7.5a1 1 0 0 1-1.41 0z" /><circle cx="8.4" cy="8.4" r="1.6" /></>,
  pass: <path d="M5.5 6.5 11 12l-5.5 5.5M12.5 6.5 18 12l-5.5 5.5" />,
  trade: <path d="M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12 6 15.5 9.5 19" />,
  note: <><rect x="2.75" y="6.25" width="18.5" height="11.5" rx="1.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  house: <><path d="M4 11 12 4.5l8 6.5v8.75H4z" /><path d="M10 19.75v-5h4v5" /></>,
  hotel: <><path d="M4.5 20.25V8.25L12 4.5l7.5 3.75v12" /><path d="M2.75 20.25h18.5" /><path d="M8.25 10.5h2M13.75 10.5h2M8.25 14h2M13.75 14h2" /><path d="M10.25 20.25v-3h3.5v3" /></>,
  bank: <><path d="M3.5 9.25 12 4l8.5 5.25z" /><path d="M6 10.5v6.5M10 10.5v6.5M14 10.5v6.5M18 10.5v6.5M3.5 19.75h17" /></>,
  bars: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M9.33 4v16M14.67 4v16" /></>,
  card: <><rect x="5.25" y="3.25" width="13.5" height="17.5" rx="2" /><path d="M12 8.25l1.15 2.35 2.6.38-1.88 1.83.44 2.59L12 14.18l-2.31 1.22.44-2.59-1.88-1.83 2.6-.38z" /></>,
  crown: <><path d="M4 17.5 3 8l5 4 4-6.5 4 6.5 5-4-1 9.5z" /><path d="M4.5 20.5h15" /></>,
  step: <path d="M4.5 12h13.5M14 7.5l4.5 4.5-4.5 4.5" />,
  play: <path d="M7.5 5.25v13.5L18.25 12z" />,
  pin: <><path d="M12 20.5s6.5-5.6 6.5-10.75a6.5 6.5 0 0 0-13 0C5.5 14.9 12 20.5 12 20.5z" /><circle cx="12" cy="9.75" r="2.25" /></>,
  star: <path d="M12 3.75l2.5 5.2 5.75.75-4.2 3.95 1.05 5.7L12 16.6l-5.1 2.75 1.05-5.7L3.75 9.7l5.75-.75z" />,
  sparkle: <path d="M12 3.5 13.6 10.4 20.5 12l-6.9 1.6L12 20.5l-1.6-6.9L3.5 12l6.9-1.6z" />,

  // ---- board view ----
  follow: <><circle cx="12" cy="12" r="6.75" />{dot(12, 12, 2.25)}<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
  fullscreen: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  eye: <><path d="M2.75 12S6.25 5.75 12 5.75 21.25 12 21.25 12 17.75 18.25 12 18.25 2.75 12 2.75 12z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M2.75 12S6.25 5.75 12 5.75c1.6 0 3 .48 4.25 1.2M21.25 12s-3.5 6.25-9.25 6.25c-1.6 0-3-.48-4.25-1.2" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4.5 19.5l15-15" /></>,

  // ---- status ----
  clock: <><circle cx="12" cy="12" r="8.25" /><path d="M12 7.25V12l3.25 2" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v3.75h3.75" /><path d="M12 8v4l2.75 1.75" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5h4" /></>,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  warning: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5" />{dot(12, 17, 1)}</>,
  info: <><circle cx="12" cy="12" r="8.25" /><path d="M12 11v5.5" />{dot(12, 7.75, 1)}</>,
  question: <><circle cx="12" cy="12" r="8.25" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.33c-.62.25-1 .72-1 1.37v.45" />{dot(12, 16.6, 1)}</>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.75" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,

  // ---- account and admin ----
  user: <><circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20c.6-3.8 3.4-6 7.25-6s6.65 2.2 7.25 6" /></>,
  'user-plus': <><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 20c.5-3.6 3.1-5.75 6.5-5.75 1.6 0 3 .45 4.1 1.3M18.5 13v6M15.5 16h6" /></>,
  key: <><circle cx="8" cy="15.5" r="4.25" /><path d="M11 12.5 19.5 4M16.25 7.25l2.5 2.5M18.5 5l2 2" /></>,
  shield: <><path d="M12 3.5 19.5 6v6c0 4.4-3.2 7.4-7.5 8.5C7.7 19.4 4.5 16.4 4.5 12V6z" /><path d="M8.75 12l2.25 2.25 4.25-4.5" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><rect x="13" y="5" width="4" height="4" rx="1" /><rect x="7" y="10" width="4" height="4" rx="1" /><rect x="15" y="15" width="4" height="4" rx="1" /></>,
  logout: <path d="M14 4.5H5.5v15H14M10 12h10M16.5 8.5 20 12l-3.5 3.5" />,
  edit: <><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z" /><path d="M13.5 7l3.5 3.5" /></>,
  trash: <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l.9 13.25h9.2l.9-13.25M10 10.5v6M14 10.5v6" />,
  send: <><path d="M4 12 20 4.5l-4 15-4.5-6z" /><path d="M11.5 13.5 20 4.5" /></>,

  // ---- small controls ----
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 6v12M6 12h12" />,
  minus: <path d="M6 12h12" />,
  chevron: <path d="M7 10l5 5 5-5" />,
  'chevron-up': <path d="M7 14l5-5 5 5" />,
  'chevron-left': <path d="M14 7l-5 5 5 5" />,
  'chevron-right': <path d="M10 7l5 5-5 5" />,
  'arrow-left': <path d="M19.5 12H6M10.5 7.5 6 12l4.5 4.5" />
};

// Names that describe a use rather than a drawing. Event types (lib/events.js) map through here too.
export const ICON_ALIASES = {
  money: 'note',
  cash: 'note',
  salary: 'note',
  rent: 'note',
  tax: 'note',
  fine: 'note',
  jail: 'bars',
  rikers: 'bars',
  mine: 'deed',
  properties: 'deed',
  mortgage: 'bank',
  unmortgage: 'bank',
  build: 'house',
  sell: 'house',
  alert: 'bell',
  notifications: 'bell',
  timer: 'clock',
  countdown: 'clock',
  winner: 'crown',
  host: 'crown',
  back: 'arrow-left',
  'arrow-right': 'step',
  move: 'step',
  spectate: 'eye',
  show: 'eye',
  hide: 'eye-off',
  bankrupt: 'close',
  dismiss: 'close',
  'chevron-down': 'chevron',
  admin: 'shield',
  password: 'key',
  account: 'user',
  reconnect: 'refresh',
  ready: 'check',
  start: 'play',
  skip: 'pass',
  'free-card': 'card',
  opportunity: 'card',
  community: 'card',
  here: 'pin',
  help: 'question'
};

export const ICON_NAMES = Object.keys(ICONS);
