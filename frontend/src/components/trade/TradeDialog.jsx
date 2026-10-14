import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore, { selectMyPlayer } from '../../store/gameStore';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import Icon from '../ui/Icon';
import OfferCard from './OfferCard';
import TradeBuilder from './TradeBuilder';
import TradeHistory from './TradeHistory';
import { describeSide, emptySide, fromMySide, tradeProblems } from './tradeUtils';
import ui from '../screens/ui.module.css';
import s from './Trade.module.css';

const TABS = [
  { id: 'received', label: 'Received' },
  { id: 'sent', label: 'Sent' },
  { id: 'new', label: 'New offer' },
  { id: 'history', label: 'History' }
];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab inside the dialog.
function trapFocus(event, container) {
  if (!container) return;
  const nodes = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

const DONE = {
  accept: name => `Trade with ${name} done`,
  reject: name => `You turned down ${name}'s offer`,
  cancel: name => `Offer to ${name} cancelled`
};

const FAILED = {
  accept: "Couldn't accept the trade",
  reject: "Couldn't reject the offer",
  cancel: "Couldn't cancel the offer"
};

export default function TradeDialog({ options, onClose }) {
  const { user, isSpectator, gameStatus, players, properties, tradeVersion, incomingTradeCount, refreshTrades, applyActionResult, toast } =
    useGameStore(useShallow(state => ({
      user: state.user,
      isSpectator: state.isSpectator || !!state.user?.isSpectator,
      gameStatus: state.game?.status,
      players: state.players,
      properties: state.properties,
      tradeVersion: state.tradeVersion,
      incomingTradeCount: state.incomingTradeCount,
      refreshTrades: state.refreshTrades,
      applyActionResult: state.applyActionResult,
      toast: state.toast
    })));
  const me = useGameStore(selectMyPlayer);

  // null until the trades load when opened for one trade ({ tradeId }): its tab is picked then.
  const [tabChoice, setTab] = useState(() => {
    if (options?.counterTradeId || options?.recipientPlayerId) return 'new';
    if (options?.tradeId) return null;
    return incomingTradeCount > 0 ? 'received' : 'new';
  });
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [counterId, setCounterId] = useState(options?.counterTradeId ?? null);
  const [builderRound, setBuilderRound] = useState(0);
  const [busy, setBusy] = useState(null); // { id, action }
  const [confirmId, setConfirmId] = useState(null);
  const dialogRef = useRef(null);
  const id = useId();

  const canTrade = !!me && !isSpectator;
  const myUserId = user?.id;

  // Load on open, whenever a trade involving me changes or the store catches up after a reconnect or a new
  // game (tradeVersion), and after my own actions.
  useEffect(() => {
    if (!canTrade) return;
    let live = true;
    api('/trade')
      .then(result => {
        if (!live) return;
        setData({ active: result?.active || [], history: result?.history || [] });
        setLoadError('');
      })
      .catch(err => { if (live) setLoadError(err.message); });
    return () => { live = false; };
  }, [canTrade, tradeVersion, reload]);

  // Focus the dialog on open and give focus back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  // Full screen on a phone: the iOS status bar takes the sheet's colour while it is open.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return undefined;
    const before = meta.getAttribute('content');
    const raised = getComputedStyle(document.documentElement).getPropertyValue('--raised').trim();
    if (raised) meta.setAttribute('content', raised);
    return () => {
      if (before) meta.setAttribute('content', before);
    };
  }, []);

  const safeProperties = useMemo(() => properties || [], [properties]);
  const safePlayers = useMemo(() => players || [], [players]);
  const byId = useMemo(() => new Map(safeProperties.map(p => [p.id, p])), [safeProperties]);
  const playersById = useMemo(() => new Map(safePlayers.map(p => [p.id, p])), [safePlayers]);

  const active = data?.active || [];
  const received = active.filter(t => t.recipient_user_id === myUserId);
  const sent = active.filter(t => t.proposer_user_id === myUserId);
  const history = data?.history || [];
  const counterTrade = counterId ? received.find(t => t.id === counterId) || null : null;
  const counterGone = !!counterId && !!data && !counterTrade;
  const focusId = options?.tradeId ?? null;

  let tab = tabChoice;
  if (!tab) {
    if (sent.some(t => t.id === focusId)) tab = 'sent';
    else if (data && !received.some(t => t.id === focusId) && history.some(t => t.id === focusId)) tab = 'history';
    else tab = 'received';
  }

  function changed() {
    setReload(n => n + 1);
    Promise.resolve(refreshTrades?.()).catch(() => {});
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      trapFocus(event, dialogRef.current);
    }
  }

  function handleTabKey(event) {
    const order = TABS.map(t => t.id);
    const index = order.indexOf(tab);
    let next = null;
    if (event.key === 'ArrowRight') next = order[(index + 1) % order.length];
    else if (event.key === 'ArrowLeft') next = order[(index - 1 + order.length) % order.length];
    else if (event.key === 'Home') next = order[0];
    else if (event.key === 'End') next = order[order.length - 1];
    if (!next) return;
    event.preventDefault();
    setTab(next);
    event.currentTarget.querySelector(`[data-tab="${next}"]`)?.focus();
  }

  async function runAction(trade, action) {
    if (busy) return;
    const name = fromMySide(trade, myUserId).other.username;
    setBusy({ id: trade.id, action });
    try {
      let res;
      if (action === 'accept') res = await api(`/trade/${trade.id}/accept`, { method: 'POST' });
      else if (action === 'reject') res = await api(`/trade/${trade.id}/reject`, { method: 'POST' });
      else res = await api(`/trade/${trade.id}`, { method: 'DELETE' });
      applyActionResult(res); // the board and money update even if the socket is down
      toast({ tone: 'success', title: DONE[action](name) });
      setConfirmId(null);
    } catch (err) {
      toast({ tone: 'error', title: FAILED[action], body: err.message });
    } finally {
      setBusy(null);
      changed();
    }
  }

  function startCounter(trade) {
    setConfirmId(null);
    setCounterId(trade.id);
    setTab('new');
  }

  function abandonCounter() {
    setCounterId(null);
    setBuilderRound(n => n + 1);
  }

  async function submitOffer({ partner, give, get }) {
    const terms = {
      offeredProperties: give.properties,
      offeredMoney: give.money,
      offeredJailCards: give.jailCards,
      requestedProperties: get.properties,
      requestedMoney: get.money,
      requestedJailCards: get.jailCards
    };
    const countering = counterTrade;
    try {
      const res = countering
        ? await api(`/trade/${countering.id}/counter`, { method: 'POST', body: terms })
        : await api('/trade', { method: 'POST', body: { recipientPlayerId: partner.id, ...terms } });
      applyActionResult(res);
      toast({
        tone: 'success',
        title: countering ? `Counter-offer sent to ${partner.username}` : `Offer sent to ${partner.username}`,
        body: `You give ${describeSide(give, byId)}; you get ${describeSide(get, byId)}.`
      });
      setCounterId(null);
      setBuilderRound(n => n + 1);
      setTab('sent');
      changed();
    } catch (err) {
      toast({ tone: 'error', title: countering ? 'Counter-offer not sent' : 'Offer not sent', body: err.message });
      if (err.status === 404 || err.status === 409) changed();
    }
  }

  function builderInitial() {
    if (counterTrade) {
      const view = fromMySide(counterTrade, myUserId);
      return { partnerId: counterTrade.proposer_id, give: view.give, get: view.get };
    }
    const preset = options?.recipientPlayerId;
    const valid = safePlayers.some(p => p.id === preset && p.id !== me?.id && !p.is_bankrupt);
    const asked = valid && Array.isArray(options?.requestedProperties)
      ? options.requestedProperties.filter(pid => byId.get(pid)?.owner_id === preset)
      : [];
    return { partnerId: valid ? preset : null, give: emptySide(), get: { ...emptySide(), properties: asked } };
  }

  const counts = { received: data ? received.length : incomingTradeCount || 0, sent: sent.length };

  function renderOffers(list, kind) {
    if (!data && !loadError) return <Loading />;
    if (!list.length) {
      return (
        <div className={s.empty}>
          <Icon name="trade" size={28} />
          <p>{kind === 'received' ? 'No offers are waiting for you.' : 'You have no open offers.'}</p>
          {gameStatus === 'in_progress' && !me?.is_bankrupt && (
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setTab('new')}>
              <Icon name="plus" size={20} />
              Make an offer
            </button>
          )}
        </div>
      );
    }
    const ordered = focusId ? [...list].sort((a, b) => (b.id === focusId) - (a.id === focusId)) : list;
    return ordered.map(trade => {
      const view = fromMySide(trade, myUserId);
      const problems = tradeProblems(trade, { byId, properties: safeProperties, players: safePlayers, myPlayerId: me?.id });
      const busyAction = busy?.id === trade.id ? busy.action : busy ? 'other' : null;
      return (
        <OfferCard
          key={trade.id}
          trade={trade}
          view={view}
          other={playersById.get(view.other.playerId)}
          byId={byId}
          properties={safeProperties}
          myPlayerId={me?.id}
          problems={problems}
          busy={busyAction}
          highlight={trade.id === focusId}
          confirming={confirmId === trade.id}
          onAccept={() => setConfirmId(trade.id)}
          onConfirmAccept={() => runAction(trade, 'accept')}
          onCancelConfirm={() => setConfirmId(null)}
          onReject={() => runAction(trade, 'reject')}
          onCounter={() => startCounter(trade)}
          onWithdraw={() => runAction(trade, 'cancel')}
        />
      );
    });
  }

  function renderBuilder() {
    if (gameStatus !== 'in_progress') {
      return <p className={ui.notice}><Icon name="info" size={18} />Trades open once the game has started.</p>;
    }
    if (me.is_bankrupt) {
      return <p className={ui.notice}><Icon name="info" size={18} />You are bankrupt, so you can no longer trade.</p>;
    }
    if (counterId && !data && !loadError) {
      return <Loading text="Loading the offer…" />;
    }
    return (
      <>
        {counterGone && (
          <p className={`${ui.notice} ${s.gone}`} role="status">
            <Icon name="info" size={18} />
            That offer is no longer open, so there is nothing to counter. You can make a new offer instead.
          </p>
        )}
        <TradeBuilder
          key={counterTrade ? `counter-${counterTrade.id}` : `new-${builderRound}`}
          me={me}
          players={safePlayers}
          properties={safeProperties}
          byId={byId}
          initial={builderInitial()}
          counterTrade={counterTrade}
          onSubmit={submitOffer}
          onAbandonCounter={abandonCounter}
        />
      </>
    );
  }

  return (
    <div className={`${ui.theme} ${s.overlay}`}>
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className={s.head}>
          <div className={s.headText}>
            <h2 id={`${id}-title`} className={s.title}>Trade</h2>
            {me && (
              <p className={s.headCash}>
                You have <span className="ui-money">{money(me.money)}</span>
              </p>
            )}
          </div>
          <button type="button" className={`ui-btn ui-btn--icon ${s.close}`} onClick={onClose} aria-label="Close trades">
            <Icon name="close" size={20} />
          </button>
        </header>

        {!canTrade ? (
          <div className={s.body}>
            <p className={ui.notice}>
              <Icon name="eye" size={18} />
              {isSpectator ? 'Spectators can follow trades in the game log, but only players can trade.' : 'Only players in the game can trade.'}
            </p>
          </div>
        ) : (
          <>
            <div className={`ui-seg ${s.tabs}`} role="tablist" aria-label="Trades" onKeyDown={handleTabKey}>
              {TABS.map(t => {
                const selected = tab === t.id;
                const count = counts[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    data-tab={t.id}
                    id={`${id}-tab-${t.id}`}
                    aria-selected={selected}
                    aria-controls={`${id}-panel-${t.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                    {count > 0 && (
                      t.id === 'received'
                        ? <span className="ui-badge">{count}<span className="sr-only"> waiting</span></span>
                        : <span className={s.tabCount}>{count}<span className="sr-only"> open</span></span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className={s.body} aria-busy={!data && !loadError}>
              {loadError && (
                <div className={`${ui.notice} ${ui.noticeError} ${s.loadError}`} role="alert">
                  <Icon name="warning" size={18} />
                  <span className={s.loadErrorText}>Could not load trades: {loadError}</span>
                  <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" onClick={() => setReload(n => n + 1)}>
                    <Icon name="refresh" size={18} />
                    Try again
                  </button>
                </div>
              )}

              {TABS.map(t => (
                <div
                  key={t.id}
                  id={`${id}-panel-${t.id}`}
                  role="tabpanel"
                  aria-labelledby={`${id}-tab-${t.id}`}
                  hidden={tab !== t.id}
                  className={`${s.panel} ${t.id === 'new' ? s.panelNew : ''}`}
                >
                  {t.id === 'received' && renderOffers(received, 'received')}
                  {t.id === 'sent' && renderOffers(sent, 'sent')}
                  {t.id === 'new' && renderBuilder()}
                  {t.id === 'history' && (
                    !data && !loadError
                      ? <Loading />
                      : <TradeHistory trades={history} myUserId={myUserId} byId={byId} playersById={playersById} focusId={focusId} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Loading({ text = 'Loading trades…' }) {
  return (
    <p className={s.loading} role="status">
      <span className="ui-spinner" aria-hidden="true" />
      {text}
    </p>
  );
}
