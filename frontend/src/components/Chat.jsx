import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { playerColor } from '../lib/colors';
import Icon from './ui/Icon';
import Medallion from './ui/Medallion';
import { clockTime, dayKey, dayLabel, isoString, toDate } from './screens/time';
import ui from './screens/ui.module.css';
import s from './screens/Chat.module.css';

const MAX_LENGTH = 500;
const COUNT_FROM = 400; // the character count shows once a message gets long
const GROUP_GAP_MS = 5 * 60 * 1000; // consecutive messages from one person within 5 minutes share a header
const NEAR_BOTTOM_PX = 48;

/**
 * The game chat as a docked panel: it fills whatever box the parent gives it and positions nothing
 * itself. Pass `title` to show a small header; by default the parent's tab or heading names it.
 * Messages from others sit on raised bubbles beside the sender's medallion; your own are brass-tinted on
 * the right. Emoji typed into chat stay as typed.
 */
export default function Chat({ title, className = '' }) {
  const { messages, players, userId, isSpectator, sendChat, fetchChat } = useGameStore(useShallow(state => ({
    messages: state.chatMessages,
    players: state.players,
    userId: state.user?.id,
    isSpectator: state.isSpectator || !!state.user?.isSpectator,
    sendChat: state.sendChat,
    fetchChat: state.fetchChat
  })));

  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [seenCount, setSeenCount] = useState(() => (Array.isArray(messages) ? messages.length : 0));
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const id = useId();

  const list = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

  const playersByUser = useMemo(() => {
    const map = new Map();
    for (const player of players || []) map.set(player.user_id, player);
    return map;
  }, [players]);

  // The store loads the chat with the session; fetch here only if this panel opens with nothing in it.
  const startedEmpty = useRef(list.length === 0);
  useEffect(() => {
    if (startedEmpty.current) Promise.resolve(fetchChat?.()).catch(() => {});
  }, [fetchChat]);

  // Follow new messages only while the reader is at the bottom; never scroll anything but the list.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [list]);

  // The panel may mount inside a hidden tab (zero height) or shrink when the phone keyboard opens: pin it
  // to the bottom again whenever its size changes.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleScroll(event) {
    const el = event.currentTarget;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickToBottom.current = bottom;
    setAtBottom(bottom);
    if (bottom) setSeenCount(list.length);
  }

  function jumpToBottom() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTop = el.scrollHeight;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    stickToBottom.current = true;
    try {
      await sendChat(text);
      setDraft(current => (current.trim() === text ? '' : current));
    } catch (err) {
      setError(err?.message || 'Message not sent. Try again.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const unseen = !atBottom && list.length > seenCount;
  const showCount = draft.length >= COUNT_FROM;

  // Day dividers and grouped headers.
  const rows = [];
  let previous = null;
  for (const msg of list) {
    const when = toDate(msg.timestamp ?? msg.created_at);
    const day = dayKey(when);
    if (day && day !== dayKey(previous?.when)) {
      rows.push({ kind: 'day', key: `day-${day}`, label: dayLabel(when) });
      previous = null;
    }
    const grouped = previous && previous.userId === msg.user_id && when && previous.when &&
      when.getTime() - previous.when.getTime() < GROUP_GAP_MS;
    rows.push({ kind: 'msg', key: msg.id ?? `${msg.user_id}-${msg.timestamp}`, msg, when, grouped });
    previous = { userId: msg.user_id, when };
  }

  return (
    <section className={`${ui.theme} ${s.chat} ${className}`} aria-label={title ? undefined : 'Chat'} aria-labelledby={title ? `${id}-title` : undefined}>
      {title && (
        <header className={s.header}>
          <h2 id={`${id}-title`} className={s.title}>{title}</h2>
        </header>
      )}

      <div className={s.listWrap}>
        <div ref={listRef} className={s.list} onScroll={handleScroll} role="log" aria-label="Chat messages" tabIndex={0}>
          {rows.length === 0 ? (
            <div className={s.empty}>
              <Icon name="chat" size={28} />
              <p>{isSpectator ? 'No messages yet.' : 'No messages yet. Say hello.'}</p>
            </div>
          ) : (
            <ol className={s.messages}>
              {rows.map(row => {
                if (row.kind === 'day') {
                  return (
                    <li key={row.key} className={`ui-divider ui-divider--label ${s.day}`}>
                      <span>{row.label}</span>
                    </li>
                  );
                }
                const { msg, when, grouped } = row;
                const mine = msg.user_id === userId;
                const player = playersByUser.get(msg.user_id);
                const time = when && <time className={s.time} dateTime={isoString(when)}>{clockTime(when)}</time>;
                return (
                  <li key={row.key} className={`${s.message} ${grouped ? s.grouped : ''} ${mine ? s.mine : ''}`}>
                    {!mine && (
                      <span className={s.avatar}>
                        {!grouped && (player
                          ? <Medallion player={player} size={30} />
                          : <Medallion icon="user" size={30} />)}
                      </span>
                    )}
                    <div className={s.bubble}>
                      {grouped || mine ? (
                        <span className="sr-only">{mine ? 'You' : msg.username}: </span>
                      ) : (
                        <p className={s.meta}>
                          <span className={s.author} style={{ '--pc': playerColor(player) }}>{msg.username}</span>
                          {time}
                        </p>
                      )}
                      <p className={s.text}>{msg.message}</p>
                      {mine && !grouped && <p className={s.mineTime}>{time}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {unseen && (
          <button type="button" className={`ui-btn ui-btn--sm ${s.jump}`} onClick={jumpToBottom}>
            New messages
            <Icon name="chevron" size={18} />
          </button>
        )}
      </div>

      {isSpectator ? (
        <p className={s.spectator}>
          <Icon name="eye" size={18} />
          Spectators can read the chat.
        </p>
      ) : (
        <form className={s.form} onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor={`${id}-input`}>Message</label>
          <div className={`ui-input ${s.field}`}>
            <input
              ref={inputRef}
              id={`${id}-input`}
              type="text"
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                if (error) setError('');
              }}
              maxLength={MAX_LENGTH}
              placeholder="Message everyone"
              autoComplete="off"
              enterKeyHint="send"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}`}
            />
            <button type="submit" className={`ui-input__act ${s.send}`} disabled={!draft.trim() || sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {(error || showCount) && (
            <div className={s.formMeta}>
              {error ? <p id={`${id}-error`} className="ui-error" role="alert">{error}</p> : <span />}
              {showCount && (
                <span className={`${s.counter} ${MAX_LENGTH - draft.length <= 50 ? s.counterWarn : ''}`} aria-hidden="true">
                  {draft.length}/{MAX_LENGTH}
                </span>
              )}
            </div>
          )}
          <span id={`${id}-count`} className="sr-only">{draft.length} of {MAX_LENGTH} characters</span>
        </form>
      )}
    </section>
  );
}
