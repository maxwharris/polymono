// The 3D board. Fills its parent; takes no props. Reads the game from gameStore with selectors only, and
// plays dice and token animations from game events through the director (board/director.js).
//
// Pieces live in components/board/: layout (geometry), Spaces (tiles, bands, owners, buildings, clicks),
// Tokens, Dice, CameraRig, Floaters, director + registry (animation), assets (hashed URLs, preloading).
// Preload from the lobby with `import { preloadBoard } from './board/assets'`.
import { memo, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import useBoardAnim from '../store/boardAnim';
import { playerColor } from '../lib/colors';
import { SLAB, SLAB_HEIGHT } from './board/layout';
import Spaces, { Center, LandingGlow } from './board/Spaces';
import Tokens from './board/Tokens';
import Dice from './board/Dice';
import CameraRig from './board/CameraRig';
import Floaters from './board/Floaters';
import ErrorBoundary from './board/ErrorBoundary';
import { startDirector } from './board/director';
import css from './board/board.module.css';

const BACKGROUND = '#14201a';

function onCreated({ gl, invalidate }) {
  gl.toneMapping = THREE.NeutralToneMapping; // ACES greys out the cream tiles
  // frameloop="demand": nothing would redraw when a lost context comes back (iOS drops it in the background).
  gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#33443a', 1.15]} />
      <directionalLight
        position={[14, 30, 18]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
    </>
  );
}

function Table() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-SLAB_HEIGHT - 0.02} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#2b1d14" roughness={0.85} />
      </mesh>
      <mesh position-y={-SLAB_HEIGHT / 2} receiveShadow castShadow>
        <boxGeometry args={[SLAB, SLAB_HEIGHT, SLAB]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.9} />
      </mesh>
    </>
  );
}

function Landing() {
  const landing = useBoardAnim(s => s.landing);
  const color = useGameStore(s => {
    const player = landing ? s.players.find(p => p.id === landing.playerId) : null;
    return player ? playerColor(player) : null;
  });
  return <LandingGlow landing={landing} color={color} />;
}

function Director() {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => startDirector({ invalidate }), [invalidate]);
  return null;
}

function LoadingOverlay() {
  const { active, progress } = useProgress();
  const done = !active || progress >= 100;
  return (
    <div className={css.progress} data-done={done} role="status" aria-live="polite" aria-hidden={done}>
      <span>{done ? 'Board ready' : 'Loading board'}</span>
      <span className={css.bar}><i style={{ width: `${Math.round(progress)}%` }} /></span>
    </div>
  );
}

function ViewControls() {
  const follow = useBoardAnim(s => s.follow);
  const setFollow = useBoardAnim(s => s.setFollow);
  const recenter = useBoardAnim(s => s.recenter);
  return (
    <div className={css.controls}>
      <button type="button" onClick={recenter} title="Show the whole board" aria-label="Show the whole board">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
      <button type="button" aria-pressed={follow} onClick={() => setFollow(!follow)} title="Camera follows moving tokens">
        <span className={css.dot} />
        Follow
      </button>
    </div>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <Lights />
      <Table />
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
