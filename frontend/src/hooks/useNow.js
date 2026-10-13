import { useSyncExternalStore } from 'react';

// One shared ticking clock per period: every component using useNow(30000) re-renders on the same tick.
const clocks = new Map();

function clockFor(period) {
  let clock = clocks.get(period);
  if (!clock) {
    clock = { now: Date.now(), listeners: new Set(), timer: null };
    clocks.set(period, clock);
  }
  return clock;
}

function subscribe(period, listener) {
  const clock = clockFor(period);
  clock.listeners.add(listener);
  if (!clock.timer) {
    clock.now = Date.now();
    clock.timer = setInterval(() => {
      clock.now = Date.now();
      clock.listeners.forEach(fn => fn());
    }, period);
  }
  return () => {
    clock.listeners.delete(listener);
    if (!clock.listeners.size) {
      clearInterval(clock.timer);
      clock.timer = null;
    }
  };
}

// useSyncExternalStore re-subscribes whenever it gets a new subscribe function, and subscribing can reset the
// clock, so each period needs one stable subscribe/snapshot pair (an inline arrow looped forever).
const hooks = new Map();

function hooksFor(period) {
  let h = hooks.get(period);
  if (!h) {
    h = { subscribe: listener => subscribe(period, listener), snapshot: () => clockFor(period).now };
    hooks.set(period, h);
  }
  return h;
}

/** The current time in ms, updated every `period` ms. */
export default function useNow(period = 30000) {
  const { subscribe: sub, snapshot } = hooksFor(period);
  return useSyncExternalStore(sub, snapshot, snapshot);
}
