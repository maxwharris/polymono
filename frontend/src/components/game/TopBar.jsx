import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectCurrentPlayer, selectIsMyTurn, selectMyPlayer } from '../../store/gameStore';
import { playerColor } from '../../lib/colors';
import { money } from '../../lib/format';
import { tokenEmoji } from '../../lib/tokens';
import { Countdown } from './bits';
import ChangePasswordDialog from './ChangePasswordDialog';

function TurnPill() {
  const { status, deadline } = useGameStore(useShallow(s => ({ status: s.game?.status, deadline: s.game?.turn_deadline })));
  const current = useGameStore(selectCurrentPlayer);
  const isMyTurn = useGameStore(selectIsMyTurn);

  if (status === 'completed') return <span className="pill pill--over">Game over</span>;
  if (!current) return null;
  return (
    <span className={`pill${isMyTurn ? ' pill--mine pulse' : ''}`} style={{ '--pc': playerColor(current) }}>
      <span className="pill-dot" aria-hidden="true" />
      <span className="pill-text">{isMyTurn ? 'Your turn' : `${current.username}'s turn`}</span>
      <Countdown deadline={deadline} suffix="" className="pill-time" />
    </span>
  );
}

function UserMenu() {
  const { user, isSpectator, soundOn, setSoundOn, logout } = useGameStore(useShallow(s => ({
    user: s.user,
    isSpectator: s.isSpectator,
    soundOn: s.soundOn,
    setSoundOn: s.setSoundOn,
    logout: s.logout
  })));
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const pick = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(o => !o)}
      >
        <span className="menu-avatar" aria-hidden="true">{isSpectator ? '👀' : tokenEmoji(user.tokenType)}</span>
        <span className="menu-name">{user.username}</span>
        <span className="menu-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="menu-list" role="menu" id={menuId}>
          <p className="menu-who" role="presentation">{isSpectator ? 'Spectating' : `Signed in as ${user.username}`}</p>
          <button type="button" role="menuitemcheckbox" aria-checked={soundOn} className="menu-item" onClick={() => setSoundOn(!soundOn)}>
            <span aria-hidden="true">{soundOn ? '🔔' : '🔕'}</span> Sound {soundOn ? 'on' : 'off'}
          </button>
          {!isSpectator && (
            <button type="button" role="menuitem" className="menu-item" onClick={pick(() => setPasswordOpen(true))}>
              <span aria-hidden="true">🔑</span> Change password
            </button>
          )}
          {user.isAdmin && (
            <Link role="menuitem" className="menu-item" to="/admin" onClick={() => setOpen(false)}>
              <span aria-hidden="true">🛠️</span> Admin
            </Link>
          )}
          <button type="button" role="menuitem" className="menu-item menu-item--danger" onClick={pick(() => logout())}>
            <span aria-hidden="true">🚪</span> {isSpectator ? 'Stop spectating' : 'Log out'}
          </button>
        </div>
      )}
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

export default function TopBar() {
  const me = useGameStore(selectMyPlayer);
  const isSpectator = useGameStore(s => s.isSpectator);

  return (
    <header className="top">
      <div className="top-brand">
        <img
          src="/polymono-logo.webp"
          alt=""
          className="top-logo"
          width="64"
          height="35"
          decoding="async"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
        <span className="top-word">Polymono</span>
      </div>
      <TurnPill />
      <div className="top-right">
        {isSpectator && <span className="g-tag">Spectating</span>}
        {me && (
          <span className="top-cash" aria-label={`Your cash: ${money(me.money)}`}>
            <span className="money">{money(me.money)}</span>
          </span>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
