import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './components/ui/ui.css'; // shared ui-* classes (components layer), available to every screen
import App from './App.jsx';
import { installAudioUnlock } from './lib/sound';
import { reloadForNewBuild } from './lib/reload';

// Browsers only allow audio after a gesture: taps and key presses unlock it (and revive it after iOS pauses it).
installAudioUnlock();

// A chunk from before a deploy is gone (lazy Board, three.js): reload once to pick up the new build. If that
// is not possible, the import still fails and BoardBoundary offers the reload.
window.addEventListener('vite:preloadError', () => {
  reloadForNewBuild();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
