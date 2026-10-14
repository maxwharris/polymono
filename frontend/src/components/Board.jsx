// The 3D board. Fills its parent; takes no props. Reads the game from gameStore with selectors only, and
// plays dice and token animations from game events through the director (board/director.js).
//
// Pieces live in components/board/: layout (geometry), Room (lights, the navy table with its baked lamp pool,
// the lacquer slab and its brass inlay), Spaces (tiles, bands, owner discs, buildings, clicks), Tokens, Dice,
// CameraRig, Floaters, director + registry (animation), assets (hashed URLs, preloading), staging (baked
// textures), environment (the metal's environment map). Preload from the lobby with
// `import { preloadBoard } from './board/assets'`.
import { memo, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import useBoardAnim from '../store/boardAnim';
import Icon from './ui/Icon';
import Room from './board/Room';
import Spaces, { ART_COUNT, Center, LandingGlow } from './board/Spaces';
import Tokens from './board/Tokens';
import Dice from './board/Dice';
import CameraRig from './board/CameraRig';
import Floaters from './board/Floaters';
import ErrorBoundary from './board/ErrorBoundary';
import { startDirector } from './board/director';
import css from './board/board.module.css';

function onCreated({ gl, invalidate }) {
  gl.toneMapping = THREE.NeutralToneMapping; // ACES greys out the cream tiles
  // frameloop="demand": nothing would redraw when a lost context comes back (iOS drops it in the background).
  gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
}

function Landing() {
  const landing = useBoardAnim(s => s.landing);
  return <LandingGlow landing={landing} />;
}

function Director() {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => startDirector({ invalidate }), [invalidate]);
  return null;
}

const PILL_AFTER_MS = 600; // a warm cache draws the board sooner than this: no pill at all

// "Loading the board" while its art (the centre and the tiles) is still missing, and only once that has taken
// a moment. It counts the art itself, not drei's useProgress: that also waits on the token models, which
// already stand in as plain pawns, so it kept the pill over a board that was visibly drawn.
function LoadingOverlay() {
  const drawn = useBoardAnim(s => s.artDrawn);
  const done = useBoardAnim(s => s.artReady);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), PILL_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const hidden = done || !late;
  return (
    <div className={css.progress} data-done={done} data-hidden={hidden} role="status" aria-live="polite" aria-hidden={hidden}>
      <span>{done ? 'Board ready' : 'Loading the board'}</span>
      <span className={css.bar}><i style={{ width: `${Math.round((100 * Math.min(drawn, ART_COUNT)) / ART_COUNT)}%` }} /></span>
    </div>
  );
}

// Top right, clear of New Year's Eve and the tokens on it: "Show the whole board" and the Follow toggle,
// which names the player while the camera is tracking them.
function ViewControls() {
  const follow = useBoardAnim(s => s.follow);
  const setFollow = useBoardAnim(s => s.setFollow);
  const recenter = useBoardAnim(s => s.recenter);
  const tracking = useBoardAnim(s => s.tracking);
  const name = useGameStore(s => (tracking == null ? null : s.players?.find(p => p.id === tracking)?.username ?? null));
  return (
    <div className={css.controls}>
      <button type="button" className={css.round} onClick={recenter} title="Show the whole board" aria-label="Show the whole board">
        <Icon name="fullscreen" size={20} />
      </button>
      <button type="button" className={css.follow} aria-pressed={follow} onClick={() => setFollow(!follow)} title="Camera follows moving tokens">
        <span className={css.lamp} aria-hidden="true" />
        {follow && name ? <span>Following {name}</span> : <span>Follow</span>}
      </button>
    </div>
  );
}

function Scene() {
  return (
    <>
      <Room />
      <Center />
      <Spaces />
      <Tokens />
      <Dice />
      <Landing />
      <Floaters />
      <CameraRig />
      <Director />
    </>
  );
}

function Board() {
  const [failed, setFailed] = useState(false);
  // R3F creates the renderer in an async step that no error boundary sees, so catch a WebGL failure here.
  const gl = useCallback((defaults) => {
    try {
      return new THREE.WebGLRenderer({ ...defaults, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      console.warn('[board] WebGL could not start:', err?.message || err);
      setFailed(true);
      return new Promise(() => {}); // never settles: the canvas is unmounted instead
    }
  }, []);
  const unavailable = <div className={css.unavailable}>The 3D board could not start on this device.</div>;
  if (failed) return <div className={css.root}>{unavailable}</div>;
  return (
    <div className={css.root}>
      <ErrorBoundary label="3D board" fallback={unavailable}>
        <Canvas
          shadows
          dpr={[1, 2]}
          frameloop="demand"
          camera={{ fov: 35, near: 0.5, far: 400, position: [0, 40, 35] }}
          gl={gl}
          onCreated={onCreated}
        >
          <Scene />
        </Canvas>
      </ErrorBoundary>
      <LoadingOverlay />
      <ViewControls />
    </div>
  );
}

export default memo(Board);
