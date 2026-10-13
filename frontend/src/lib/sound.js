// Tiny WebAudio beeps, no asset files. Browsers (iOS especially) only allow audio after a user gesture, so
// the context is created on the first pointerdown/keydown, and resumed on a later gesture whenever iOS has
// suspended or interrupted it (app switch, screen lock, a call). The on/off preference lives in localStorage.
import { readItem, writeItem } from './storage';

const PREF_KEY = 'polymono:sound';

// [frequency Hz, start s, duration s]
const SOUNDS = {
  turn: [[659, 0, 0.14], [880, 0.15, 0.16], [1319, 0.32, 0.3]],
  gain: [[988, 0, 0.08], [1319, 0.09, 0.16]],
  loss: [[392, 0, 0.12], [262, 0.13, 0.22]],
  card: [[523, 0, 0.09], [784, 0.1, 0.14]],
  tap: [[660, 0, 0.05]]
};

let context = null;
let enabled = readItem(PREF_KEY) === 'on';

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(on) {
  enabled = !!on;
  writeItem(PREF_KEY, enabled ? 'on' : 'off');
}

export function unlockAudio() {
  try {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
    }
    if (context.state === 'closed') {
      context = null;
      unlockAudio();
    } else if (context.state !== 'running') {
      context.resume().catch(() => {}); // 'suspended', or iOS's 'interrupted'
    }
  } catch {
    context = null;
  }
}

// Stays installed: every gesture (and coming back to the tab) revives a context the OS has paused.
export function installAudioUnlock() {
  const unlock = () => {
    if (!context || context.state !== 'running') unlockAudio();
  };
  for (const type of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (context && document.visibilityState === 'visible') unlock();
  });
}

// `background: true` lets a sound play while the tab is hidden (the your-turn chime).
export function playSound(name, { background = false } = {}) {
  const notes = SOUNDS[name];
  if (!enabled || !notes || !context || context.state !== 'running') return;
  if (!background && document.visibilityState !== 'visible') return;
  const start = context.currentTime + 0.01;
  for (const [frequency, offset, duration] of notes) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(start + offset);
    osc.stop(start + offset + duration + 0.02);
  }
}
