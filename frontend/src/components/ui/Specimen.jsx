import { useRef, useState } from 'react';
import { PLAYER_COLORS } from '../../lib/colors';
import { GROUP_LABELS, GROUP_ORDER, PROPERTY_COLORS } from '../../lib/board';
import { TOKEN_TYPES, tokenLabel } from '../../lib/tokens';
import Icon from './Icon';
import { ICON_ALIASES, ICON_NAMES } from './icons';
import Medallion, { TokenGlyph } from './Medallion';
import TurnDial from './TurnDial';
import Wordmark from './Wordmark';
import { upNextLine } from './turnOrder';
import './Specimen.css';

// Dev-only page (mounted at /specimen when import.meta.env.DEV): every token, icon, glyph, medallion, dial
// and surface in one place, for screenshots and for the agents restyling the screens.

const PLAYERS = [
  { id: 1, user_id: 1, username: 'max', player_color: 'red', token_type: 'taxi', turn_order: 1, money: 1360 },
  { id: 2, user_id: 2, username: 'jack', player_color: 'blue', token_type: 'pigeon', turn_order: 2, money: 640 },
  { id: 3, user_id: 3, username: 'youngeun', player_color: 'green', token_type: 'rat', turn_order: 3, money: 905 },
  { id: 4, user_id: 4, username: 'seabass', player_color: 'yellow', token_type: 'subway', turn_order: 4, money: 1120 },
  { id: 5, user_id: 5, username: 'jason', player_color: 'purple', token_type: 'bull', turn_order: 5, money: 780 },
  { id: 6, user_id: 6, username: 'raymond', player_color: 'orange', token_type: 'empire', turn_order: 6, money: 410 }
];
const ME = 1;
// Turn-panel headlines to test against the 375px budgets (must-fix #1).
const HEADLINES = [
  'Your turn',
  <>You landed on <em>Tribeca</em></>,
  'One World Trade Center',
  'jack is deciding on Wall Street',
  <>Raise <span className="ui-money">$120</span> to pay youngeun</>,
  <>You landed on <em>One World Trade Center</em></>
];
const WITH_BANKRUPT = PLAYERS.map(p => (p.username === 'jason' ? { ...p, is_bankrupt: true } : p));

const SWATCHES = [
  ['Room and lacquer', ['room', 'table', 'table-edge', 'lacquer', 'raised', 'raised-hover', 'well', 'seam', 'seam-strong', 'medal', 'dial-plate']],
  ['Text', ['marble', 'limestone', 'slate']],
  ['Brass', ['brass-200', 'brass-300', 'brass-400', 'brass-500', 'brass-600', 'brass-800', 'brass-metal']],
  ['Paper', ['paper', 'paper-2', 'paper-line', 'paper-now', 'ink', 'ink-2', 'brass-ink', 'stamp', 'house-paper', 'hotel-paper']],
  ['Signals', ['go', 'stop', 'stop-ink', 'offline', 'disabled-bg', 'disabled-fg', 'house-night', 'hotel-night']]
];

function Section({ title, note, children, wide = false }) {
  return (
    <section className={`spec-sec${wide ? ' spec-sec--wide' : ''}`}>
      <h2 className="spec-h">{title}</h2>
      {note && <p className="spec-note">{note}</p>}
      {children}
    </section>
  );
}

function Chip({ token, label, value }) {
  return (
    <figure className="spec-chip">
      <i style={{ background: value ?? `var(--${token})` }} />
      <figcaption>{label ?? token}</figcaption>
    </figure>
  );
}

function Die({ value }) {
  return (
    <span className="ui-die" data-value={value}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
    </span>
  );
}

export default function Specimen() {
  const sheetRef = useRef(null);
  const modalRef = useRef(null);
  const [ready, setReady] = useState(true);
  const [seg, setSeg] = useState('new');
  const [tab, setTab] = useState('activity');
  const [dialTurn, setDialTurn] = useState(1);
  const turnUser = PLAYERS[dialTurn].user_id;

  return (
    <main className="spec">
      <header className="spec-top">
        <Wordmark size="lg" sub="Midnight Deco, design system specimen" inline />
        <p className="spec-note">Dev only (/specimen). Tokens in src/index.css, classes in src/components/ui/ui.css, components in src/components/ui. See README.md there.</p>
      </header>

      <div className="spec-grid">
        <Section title="Palette" note="Dark only. Brass is attention; there is no warning colour." wide>
          <div className="spec-palette">
            {SWATCHES.map(([group, tokens]) => (
              <div key={group}>
                <h3 className="spec-sub">{group}</h3>
                <div className="spec-chips">{tokens.map(t => <Chip key={t} token={t} />)}</div>
              </div>
            ))}
            <div>
              <h3 className="spec-sub">Players (lib/colors.js)</h3>
              <div className="spec-chips">{Object.entries(PLAYER_COLORS).map(([k, v]) => <Chip key={k} label={k} value={v} />)}</div>
            </div>
            <div>
              <h3 className="spec-sub">Groups (lib/board.js, lifted brown and dark blue)</h3>
              <div className="spec-chips">{GROUP_ORDER.map(g => <Chip key={g} label={GROUP_LABELS[g]} value={PROPERTY_COLORS[g]} />)}<Chip token="g-special" label="Special band" /></div>
            </div>
          </div>
        </Section>

        <Section title="Type" note="Antonio for names and headlines, Jost for text and every amount (tabular figures).">
          <div className="spec-type">
            <p className="ui-display-xl">Polymono</p>
            <p className="ui-display-l">One World Trade Center</p>
            <div className="spec-budgets">
              {[[291, 'Headline budget at 375px: 375 − 2×16 gutter − 40 medallion − 12 gap'], [217, 'With dice at the right (62 + 12 more)']].map(([w, note]) => (
                <div key={w} className="spec-phone-line" style={{ width: w }}>
                  {HEADLINES.map((h, i) => <p key={i} className="ui-headline">{h}</p>)}
                  <span className="spec-note">{w}px. {note}</span>
                </div>
              ))}
            </div>
            <p className="ui-display-s">Your turn</p>
            <p className="ui-body">Body. jason rolled 6 and 5 and landed on Chelsea. seabass paid you $25 rent.</p>
            <p className="ui-label-text">Label. Buttons, names, row labels</p>
            <p className="ui-meta">Meta. 21h 40m left, worth $2,410</p>
            <p className="ui-micro spec-micro">Micro. Tab bar labels</p>
            <div className="spec-money">
              <span className="ui-money ui-money--xl">$1,360</span>
              <span className="ui-money ui-money--xl">$1,111</span>
              <span className="ui-money ui-money--xl">$8,888</span>
            </div>
          </div>
        </Section>

        <Section title="Icons" note="24px grid, 1.75 stroke, currentColor. <Icon name> also takes aliases (money, jail, mortgage, back…).">
          <div className="spec-icons">
            {ICON_NAMES.map(name => (
              <figure key={name} className="spec-icon">
                <Icon name={name} />
                <figcaption>{name}</figcaption>
              </figure>
            ))}
          </div>
          <p className="spec-note spec-aliases">Aliases: {Object.entries(ICON_ALIASES).map(([a, n]) => `${a} → ${n}`).join(', ')}</p>
        </Section>

        <Section title="Token medallions" note="Glyphs traced from the six 3D models. Sizes 22 (feed), 30 (chips), 36 (top bar), 44 (rows), 48 (desktop).">
          <div className="spec-meds">
            {PLAYERS.map((p, i) => (
              <div key={p.id} className="spec-med-row">
                {[22, 30, 36, 44, 48].map(s => <Medallion key={s} player={p} size={s} online={s === 44 ? i !== 4 : undefined} current={s === 48 && i === 1} />)}
                <TokenGlyph token={p.token_type} size={24} className="spec-glyph" />
                <span className="spec-note">{tokenLabel(p.token_type)}</span>
              </div>
            ))}
            <div className="spec-med-row">
              <Medallion player={{ ...PLAYERS[4], is_bankrupt: true }} size={22} />
              <Medallion player={{ ...PLAYERS[4], is_bankrupt: true }} size={36} />
              <Medallion icon="eye" size={36} />
              <Medallion player={PLAYERS[0]} size={44} current online />
              <span className="spec-note">Bankrupt, spectator, current with online dot</span>
            </div>
            <div className="spec-med-row spec-feedline">
              <Medallion player={PLAYERS[2]} size={22} />
              <span>youngeun&apos;s turn</span>
              <span className="ui-meta">9h ago</span>
            </div>
            <p className="spec-note">All six token types: {TOKEN_TYPES.join(', ')}</p>
          </div>
        </Section>

        <Section title="Turn dial" note="Phone 76: only the current segment lit, brass tick on yours. Desktop 92 and the login emblem show every colour.">
          <div className="spec-dials">
            <figure>
              <TurnDial players={PLAYERS} currentUserId={turnUser} myUserId={ME} size={76} />
              <figcaption>76, {PLAYERS[dialTurn].username}&apos;s turn. {upNextLine(PLAYERS, turnUser, ME) ?? 'Your turn'}</figcaption>
            </figure>
            <figure>
              <TurnDial players={PLAYERS} currentUserId={ME} myUserId={ME} size={76} />
              <figcaption>76, your turn</figcaption>
            </figure>
            <figure>
              <TurnDial players={PLAYERS.slice(0, 3)} currentUserId={3} myUserId={ME} size={76} />
              <figcaption>76, three players</figcaption>
            </figure>
            <figure>
              <TurnDial players={WITH_BANKRUPT} currentUserId={turnUser} myUserId={ME} size={92} />
              <figcaption>92, jason bankrupt</figcaption>
            </figure>
            <figure>
              <TurnDial size={176} sweep decorative />
              <figcaption>176, login emblem (sweeps in)</figcaption>
            </figure>
          </div>
          <div className="spec-row">
            <button type="button" className="ui-btn ui-btn--sm" onClick={() => setDialTurn(t => (t + 1) % PLAYERS.length)}>
              <Icon name="step" size={20} />Pass the turn
            </button>
          </div>
        </Section>

        <Section title="Buttons" note="One filled brass button per view. A blocked action stays visible, with its reason underneath.">
          <div className="spec-stack">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"><Icon name="dice" />Roll</button>
            <div className="spec-two">
              <button type="button" className="ui-btn ui-btn--primary ui-btn--lg">
                <span className="ui-btn__stack"><span>Buy for <span className="ui-money">$200</span></span><span className="ui-btn__sub">Leaves you $1,160</span></span>
              </button>
              <button type="button" className="ui-btn ui-btn--lg">Pass</button>
            </div>
            <div className="spec-row">
              <button type="button" className="ui-btn ui-btn--secondary"><Icon name="eye" size={20} />Watch as a spectator</button>
              <button type="button" className="ui-btn ui-btn--ghost"><Icon name="deed" size={20} />My properties</button>
              <button type="button" className="ui-btn ui-btn--ghost"><Icon name="trade" size={20} />Trade <span className="ui-badge">1</span></button>
            </div>
            <div className="spec-row">
              <button type="button" className="ui-btn ui-btn--danger">Declare bankruptcy</button>
              <button type="button" className="ui-btn ui-btn--danger-solid">Declare bankruptcy</button>
              <button type="button" className="ui-btn ui-btn--tint">Review the offer</button>
              <button type="button" className="ui-btn ui-btn--icon" aria-label="Close"><Icon name="close" size={20} /></button>
              <button type="button" className="ui-btn ui-btn--sm"><Icon name="plus" size={18} />$50</button>
            </div>
            <div>
              <button type="button" className="ui-btn ui-btn--block" disabled><span>Pay <span className="ui-money">$450</span></span></button>
              <p className="ui-reason">You&apos;re $120 short. Sell houses or mortgage first.</p>
            </div>
          </div>
        </Section>

        <Section title="Turn panel" note="ui-panel (docked, phone) and ui-panel--float (desktop).">
          <div className="spec-table">
            <div className="ui-panel">
              <div className="spec-tp-head">
                <Medallion player={PLAYERS[0]} size={40} current />
                <div className="spec-tp-text">
                  <p className="ui-headline">You landed on <em>Tribeca</em></p>
                  <p className="spec-tp-sub">Rolled 4 and 3. Your move.</p>
                </div>
                <span className="ui-dice" role="img" aria-label="Rolled 4 and 3"><Die value={4} /><Die value={3} /></span>
              </div>
              <div className="spec-two spec-tp-acts">
                <button type="button" className="ui-btn ui-btn--primary ui-btn--lg">
                  <span className="ui-btn__stack"><span>Buy for <span className="ui-money">$200</span></span><span className="ui-btn__sub">Leaves you $1,160</span></span>
                </button>
                <button type="button" className="ui-btn ui-btn--lg">Pass</button>
              </div>
              <div className="spec-more">
                <button type="button" className="ui-btn ui-btn--ghost"><Icon name="deed" size={20} />My properties</button>
                <button type="button" className="ui-btn ui-btn--ghost"><Icon name="trade" size={20} />Trade</button>
              </div>
            </div>
          </div>
          <div className="ui-panel ui-panel--float spec-float">
            <div className="spec-tp-head">
              <Medallion player={PLAYERS[1]} size={40} />
              <div className="spec-tp-text">
                <p className="ui-headline">jack is deciding on Wall Street</p>
                <span className="ui-countdown is-soon"><Icon name="clock" />2h 10m left to choose</span>
              </div>
            </div>
            <p className="ui-well spec-gap"><Icon name="bell" size={18} />Nothing needs you right now. You&apos;re up after raymond.</p>
          </div>
        </Section>

        <Section title="Surfaces" note="Toast, menu, rows, wells, paper. Sheets and modals open as real dialogs.">
          <div className="spec-stack">
            <div className="ui-toast">
              <Medallion player={PLAYERS[2]} size={36} />
              <div>
                <p className="ui-toast__title">youngeun sent you an offer</p>
                <p className="ui-toast__body">Upper West Side for your Hell&apos;s Kitchen and $60</p>
              </div>
              <button type="button" className="ui-btn ui-btn--icon ui-btn--ghost ui-toast__close" aria-label="Dismiss"><Icon name="close" size={20} /></button>
              <div className="ui-toast__actions"><button type="button" className="ui-btn ui-btn--tint">Review the offer</button></div>
            </div>
            <div className="ui-toast ui-toast--error ui-toast--plain">
              <div>
                <p className="ui-toast__title">Could not send the offer</p>
                <p className="ui-toast__body">The server did not answer. Try again.</p>
              </div>
              <button type="button" className="ui-btn ui-btn--icon ui-btn--ghost ui-toast__close" aria-label="Dismiss"><Icon name="close" size={20} /></button>
            </div>
            <div className="ui-menu" role="menu" aria-label="Account">
              <button type="button" role="menuitem" className="ui-menu__item"><Icon name="sound" size={20} />Sound on</button>
              <button type="button" role="menuitem" className="ui-menu__item"><Icon name="key" size={20} />Change password</button>
              <button type="button" role="menuitem" className="ui-menu__item"><Icon name="shield" size={20} />Admin</button>
              <div className="ui-menu__sep" role="separator" />
              <button type="button" role="menuitem" className="ui-menu__item ui-menu__item--danger"><Icon name="logout" size={20} />Log out</button>
            </div>
            <div className="spec-rows">
              {PLAYERS.slice(0, 3).map((p, i) => (
                <button key={p.id} type="button" className={`ui-row${i === 0 ? ' is-current' : ''}`} style={{ '--pc': `var(--p-${p.player_color})` }}>
                  <Medallion player={p} size={42} online={i !== 2} current={i === 0} />
                  <span>
                    <span className="spec-row-name">{p.username}{i === 0 && <span className="ui-tag">you</span>}</span>
                    <span className={`spec-row-st${i === 0 ? ' is-up' : ''}`}>
                      {i === 0 ? <><Icon name="clock" size={14} />Up now, 21h 40m left</> : i === 2 ? <><Icon name="bars" size={14} />In Rikers, try 2 of 3</> : 'Holds a free card'}
                    </span>
                  </span>
                  <span className="spec-row-money"><span className="ui-money">${p.money.toLocaleString('en-US')}</span><small>worth $2,410</small></span>
                </button>
              ))}
            </div>
            <p className="ui-well ui-well--brass"><span className="ui-dot" />4 new since you last looked</p>
            <div className="ui-divider ui-divider--label">Seen before</div>
            <div className="ui-paper spec-paper">
              <div className="ui-paper__in">
                <div className="spec-band" style={{ '--g': PROPERTY_COLORS.pink }}>Chelsea</div>
                <p className="spec-paper-line">Rent with 2 houses <span className="ui-tag ui-tag--ink">Now</span><span className="ui-money">$150</span></p>
              </div>
            </div>
            <div className="spec-row">
              <button type="button" className="ui-btn" onClick={() => sheetRef.current?.showModal()}>Open sheet</button>
              <button type="button" className="ui-btn" onClick={() => modalRef.current?.showModal()}>Open confirm</button>
            </div>
          </div>
          <dialog ref={sheetRef} className="ui-sheet" aria-labelledby="spec-sheet-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
            <div className="ui-sheet__grab" />
            <div className="ui-sheet__head">
              <h2 id="spec-sheet-title" className="ui-sheet__title">Players</h2>
              <button type="button" className="ui-btn ui-btn--icon" aria-label="Close" onClick={() => sheetRef.current?.close()}><Icon name="close" size={20} /></button>
            </div>
            <p className="ui-body">A bottom sheet on phone; a centred dialog from 900px. Tap the scrim to close.</p>
            <div className="ui-sheet__actions">
              <button type="button" className="ui-btn ui-btn--primary">Ask youngeun for it</button>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => sheetRef.current?.close()}>Close</button>
            </div>
          </dialog>
          <dialog ref={modalRef} className="ui-modal" aria-labelledby="spec-modal-title">
            <h2 id="spec-modal-title" className="ui-modal__title">Declare bankruptcy?</h2>
            <p className="ui-modal__body">Everything you own goes to youngeun. You can still watch and chat.</p>
            <div className="ui-modal__actions">
              <button type="button" className="ui-btn ui-btn--danger-solid" onClick={() => modalRef.current?.close()}>Declare bankruptcy</button>
              <button type="button" className="ui-btn" onClick={() => modalRef.current?.close()}>Cancel</button>
            </div>
          </dialog>
        </Section>

        <Section title="Controls" note="Tabs, segmented control, fields, switch, meter, countdown, badges, tags, chips, swatches, dice.">
          <div className="spec-stack">
            <div className="ui-tabs" role="tablist">
              {['activity', 'chat'].map(t => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t === 'activity' ? 'Activity' : <>Chat <span className="ui-badge">2</span></>}
                </button>
              ))}
            </div>
            <div className="ui-seg" role="tablist" aria-label="Trade">
              {[['received', 'Received'], ['sent', 'Sent'], ['new', 'New offer'], ['history', 'History']].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={seg === k} onClick={() => setSeg(k)}>
                  {l}{k === 'received' && <span className="ui-badge">1</span>}
                </button>
              ))}
            </div>
            <label className="ui-field">
              <span className="ui-label">Username</span>
              <input type="text" defaultValue="max" autoComplete="off" />
            </label>
            <div className="ui-field">
              <label className="ui-label" htmlFor="spec-pw">Password</label>
              <div className="ui-input">
                <input id="spec-pw" type="password" defaultValue="hunter22" autoComplete="off" />
                <button type="button" className="ui-input__act">Show</button>
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="spec-cash">Cash</label>
              <div className="spec-cash">
                <button type="button" className="ui-btn ui-btn--icon" aria-label="$50 less"><Icon name="minus" size={20} /></button>
                <div className="ui-input"><span className="ui-input__pre">$</span><input id="spec-cash" inputMode="numeric" defaultValue="250" /></div>
                <button type="button" className="ui-btn ui-btn--icon" aria-label="$50 more"><Icon name="plus" size={20} /></button>
              </div>
              <span className="ui-hint">Up to $1,360</span>
            </div>
            <div className="spec-row spec-between">
              <span className="ui-label-text">I&apos;m ready</span>
              <button type="button" role="switch" aria-checked={ready} aria-label="I'm ready" className="ui-switch" onClick={() => setReady(r => !r)} />
            </div>
            <div>
              <div className="ui-meter" style={{ '--value': '73%' }} role="img" aria-label="$330 of $450 in cash" />
              <p className="ui-meta spec-gap-s">$330 of $450 in cash</p>
            </div>
            <div className="spec-row">
              <span className="ui-countdown"><Icon name="clock" />21h 40m left</span>
              <span className="ui-countdown is-soon"><Icon name="clock" />2h 10m left</span>
              <span className="ui-countdown is-urgent"><Icon name="clock" />24m left</span>
            </div>
            <div className="spec-row">
              <span className="ui-badge">2</span>
              <span className="ui-badge ui-badge--brass">1</span>
              <span className="ui-dot" />
              <span className="ui-tag">you</span>
              <span className="ui-tag"><Icon name="crown" size={12} />Host</span>
              <span className="ui-tag ui-tag--stop">Mortgaged</span>
              <span className="ui-tag ui-tag--go"><Icon name="check" size={12} />Ready</span>
              <span className="ui-tag ui-tag--quiet">Not ready</span>
            </div>
            <div className="spec-row">
              <span className="ui-chip"><Medallion player={PLAYERS[4]} size={28} />jason</span>
              <span className="ui-chip"><Medallion player={PLAYERS[3]} size={28} />seabass</span>
            </div>
            <div className="spec-row">
              {GROUP_ORDER.map(g => <span key={g} className="spec-sw"><span className="ui-swatch" style={{ '--g': PROPERTY_COLORS[g] }} />{GROUP_LABELS[g]}</span>)}
            </div>
            <div className="spec-row">
              {[1, 2, 3, 4, 5, 6].map(v => <Die key={v} value={v} />)}
            </div>
          </div>
        </Section>

        <Section title="Wordmark" note="Replaces the raster logo and its white box.">
          <div className="spec-stack spec-wordmarks">
            <Wordmark />
            <Wordmark size="md" sub="Manhattan edition, day 9" inline />
            <Wordmark size="xl" sub="Manhattan edition" />
          </div>
        </Section>
      </div>
    </main>
  );
}
