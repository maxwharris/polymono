import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectCurrentPlayer, selectMyPlayer } from '../../store/gameStore';
import { gameDay } from '../../lib/rules';
import useBoardHold from '../../hooks/useBoardHold';
import useMediaQuery, { PHONE_QUERY } from '../../hooks/useMediaQuery';
import useNow from '../../hooks/useNow';
import Icon from '../ui/Icon';
import Medallion from '../ui/Medallion';
import TurnDial from '../ui/TurnDial';
import Wordmark from '../ui/Wordmark';
import { Countdown, RollingMoney } from './bits';
import AlertsDialog from './AlertsDialog';
import ChangePasswordDialog from './ChangePasswordDialog';

const TWO_COLUMNS = '(min-width: 900px) and (max-width: 1099px)';

/** The account menu: a lifted popover of icon rows under your medallion. */
function UserMenu() {
  const { user, me, isSpectator, soundOn, setSoundOn, logout } = useGameStore(useShallow(s => ({
    user: s.user,
    me: selectMyPlayer(s),
    isSpectator: s.isSpectator,
    soundOn: s.soundOn,
    setSoundOn: s.setSoundOn,
    logout: s.logout
  })));
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'password' | 'alerts'
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const items = () => [...(listRef.current?.querySelectorAll('[role^="menuitem"]') || [])];
    items()[0]?.focus();
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const list = items();
        const at = list.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
        list[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const pick = fn => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="umenu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="umenu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.username}`}
        onClick={() => setOpen(o => !o)}
      >
        {isSpectator
          ? <Medallion icon="eye" size={36} />
          : <Medallion player={me} token={me ? undefined : user.tokenType} color={me ? undefined : 'var(--brass-400)'} size={36} />}
        <span className="umenu__name">{isSpectator ? 'Spectator' : user.username}</span>
        <Icon name="chevron" size={18} className="umenu__chevron" />
      </button>
      {open && (
        <div className="ui-menu umenu__list" role="menu" id={menuId} ref={listRef} aria-label="Account">
          <p className="umenu__who">{isSpectator ? 'Watching as a spectator' : `Signed in as ${user.username}`}</p>
          <button type="button" role="menuitemcheckbox" aria-checked={soundOn} className="ui-menu__item" onClick={() => setSoundOn(!soundOn)}>
            <Icon name={soundOn ? 'sound' : 'mute'} />
            <span className="umenu__label">Sound</span>
            <span className="umenu__state">{soundOn ? 'On' : 'Off'}</span>
          </button>
          {!isSpectator && (
            <button type="button" role="menuitem" className="ui-menu__item" onClick={pick(() => setDialog('alerts'))}>
              <Icon name="bell" />
              <span className="umenu__label">Turn alerts</span>
            </button>
          )}
          {!isSpectator && (
            <button type="button" role="menuitem" className="ui-menu__item" onClick={pick(() => setDialog('password'))}>
              <Icon name="key" />
              <span className="umenu__label">Change password</span>
            </button>
          )}
          {user.isAdmin && (
            <Link role="menuitem" className="ui-menu__item" to="/admin" onClick={() => setOpen(false)}>
              <Icon name="shield" />
              <span className="umenu__label">Admin</span>
            </Link>
          )}
          <div className="ui-menu__sep" role="separator" />
          <button type="button" role="menuitem" className="ui-menu__item ui-menu__item--danger" onClick={pick(() => logout())}>
            <Icon name="logout" />
            <span className="umenu__label">{isSpectator ? 'Stop spectating' : 'Log out'}</span>
          </button>
        </div>
      )}
      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <AlertsDialog open={dialog === 'alerts'} onClose={() => setDialog(null)} />
    </div>
  );
}

/**
 * The top bar. Phone: the turn dial, whose turn it is with the time left, your cash, your medallion (the
 * account menu). From 900px: the wordmark and the day on the left, the dial and turn centred, cash and the
 * menu on the right. Between 900 and 1099px the players fold into the dial, which opens them.
 */
export default function TopBar() {
  const { game, players, user, isSpectator, sheet, openSheet, closeSheet } = useGameStore(useShallow(s => ({
    game: s.game,
    players: s.players,
    user: s.user,
    isSpectator: s.isSpectator,
    sheet: s.sheet,
    openSheet: s.openSheet,
    closeSheet: s.closeSheet
  })));
  const me = useGameStore(selectMyPlayer);
  const actual = useGameStore(selectCurrentPlayer);
  const hold = useBoardHold();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const twoColumns = useMediaQuery(TWO_COLUMNS);
  const now = useNow(60000);

  const status = game?.status;
  const myUserId = isSpectator ? null : user?.id ?? null;
  // Until the board has shown a move, the turn stays with whoever is moving.
  const current = status === 'in_progress' ? (hold.held && hold.mover ? hold.mover : actual) : null;
  const mine = !!current && current.user_id === myUserId;
  const winner = status === 'completed' ? players.find(p => p.user_id === game?.winner_user_id) : null;
  const day = game?.started_at ? gameDay(game.started_at, status === 'completed' && game.completed_at ? game.completed_at : now) : null;

  let who;
  let sub;
  if (status === 'completed') {
    who = 'Game over';
    sub = <span className="top__sub">{winner ? `${winner.id === me?.id ? 'You' : winner.username} won` : 'Thanks for playing'}</span>;
  } else if (current) {
    who = mine ? 'Your turn' : `${current.username}'s turn`;
    sub = <Countdown deadline={game?.turn_deadline} className="top__sub" />;
  } else {
    who = 'Waiting';
    sub = null;
  }

  const dial = (
    <TurnDial players={players} currentUserId={current?.user_id ?? null} myUserId={myUserId} size={isPhone ? 76 : 92} />
  );

  return (
    <header className={`top${current && !mine && current.username.length >= 7 ? ' top--long' : ''}`}>
      <div className="top__brand">
        <Wordmark size="md" inline sub={day ? `Manhattan edition, day ${day}` : 'Manhattan edition'} />
      </div>

      <div className={`top__turn${mine ? ' is-mine' : ''}`}>
        {twoColumns ? (
          <button
            type="button"
            className="top__dial top__dial--button"
            aria-expanded={sheet === 'players'}
            aria-label={`${who}. Show the players`}
            onClick={() => (sheet === 'players' ? closeSheet() : openSheet('players'))}
          >
            {dial}
          </button>
        ) : (
          <span className="top__dial">{dial}</span>
        )}
        <div className="top__who">
          <p className="top__name" aria-live="polite">{who}</p>
          {sub}
        </div>
      </div>

      <div className="top__right">
        {me && (
          <span className="top__cash">
            <Icon name="note" size={22} className="top__cash-icon" />
            <RollingMoney value={me.money} hold={hold.held} delta label="Your cash" />
          </span>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
