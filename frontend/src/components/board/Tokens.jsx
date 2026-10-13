// Player tokens. Each token is one long-lived group keyed by player id (never remounted when it moves), placed
// from boardAnim.shown rather than players[].position, and walked space by space by the director.
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import useGameStore, { selectCurrentPlayer } from '../../store/gameStore';
import useBoardAnim from '../../store/boardAnim';
import { playerColor } from '../../lib/colors';
import { JAIL, restYaw, spotPosition } from './layout';
import { clearTokenModel, tokenUrl, useTokenModel } from './assets';
import { tokens as registry } from './registry';
import ErrorBoundary from './ErrorBoundary';
import css from './board.module.css';

const SCALE = 0.48; // models are ~1.9 long: 0.9 on the board
const HOP_HEIGHT = 0.55;
const JUMP_HEIGHT = 4;
const CLICK_SLOP = 8;

const noRaycast = () => null;
const _to = new THREE.Vector3();
const _spot = new THREE.Vector3();

const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---- shared resources ----------------------------------------------------------------------------------

// A zero-download environment map for the metal tokens only (the tiles keep plain lighting).
// A lost-and-restored WebGL context empties it (it only ever lived on the GPU): see useContextRestores.
const envMaps = new WeakMap();
function environmentFor(gl) {
  let env = envMaps.get(gl);
  if (!env) {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
    pmrem.dispose();
    envMaps.set(gl, env);
  }
  return env;
}

// The lowpoly GLBs carry smooth normals; re-crease them once per model so hard edges stay crisp.
const creased = new WeakMap();
function geometriesOf(scene) {
  let list = creased.get(scene);
  if (!list) {
    list = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = toCreasedNormals(o.geometry.clone().applyMatrix4(o.matrixWorld), Math.PI / 5);
      g.computeBoundingSphere();
      list.push(g);
    });
    creased.set(scene, list);
  }
  return list;
}

/** Counts WebGL context restores (iOS drops the context in the background), after dropping the stale env map. */
function useContextRestores(gl) {
  const [restores, setRestores] = useState(0);
  useEffect(() => {
    const canvas = gl.domElement;
    const onRestored = () => {
      envMaps.delete(gl);
      setRestores(n => n + 1);
    };
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => canvas.removeEventListener('webglcontextrestored', onRestored);
  }, [gl]);
  return restores;
}

// ---- parts ---------------------------------------------------------------------------------------------

function TokenModel({ url, color }) {
  const { scene } = useTokenModel(url);
  const gl = useThree(s => s.gl);
  const restores = useContextRestores(gl);
  const geometries = useMemo(() => geometriesOf(scene), [scene]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32, envMap: environmentFor(gl), envMapIntensity: 0.9 }),
    [color, gl, restores] // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group scale={SCALE}>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} castShadow raycast={noRaycast} />
      ))}
    </group>
  );
}

function Puck({ color }) {
  return (
    <mesh position-y={0.14} castShadow raycast={noRaycast}>
      <cylinderGeometry args={[0.3, 0.34, 0.28, 24]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

// Under the player whose turn it is; pulses for two seconds when the turn starts.
function TurnRing({ color }) {
  const ref = useRef();
  const started = useRef(-1);
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (started.current < 0) started.current = now;
    const t = now - started.current;
    const k = t < 2 ? 1 + 0.22 * Math.sin(t * Math.PI * 3) * (1 - t / 2) : 1;
    ref.current.scale.set(k, k, 1);
    if (t < 2.1) state.invalidate();
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.02} raycast={noRaycast} renderOrder={2}>
      <ringGeometry args={[0.46, 0.58, 48]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

// ---- token ---------------------------------------------------------------------------------------------

const Token = memo(function Token({ id, index, x, z, yaw, color, url, name, current, snapNonce }) {
  const group = useRef();
  const target = useRef({ x, z, yaw });
  const walk = useRef(null); // { path, i, t, hop, jump, from: Vector3, resolve }
  const placed = useRef(false);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree(s => s.invalidate);

  // New spot: glide there (useFrame). Never a `position` prop: React must not fight the animation.
  useLayoutEffect(() => {
    target.current = { x, z, yaw };
    if (!placed.current) {
      group.current.position.set(x, 0, z);
      group.current.rotation.y = yaw;
      placed.current = true;
    }
    invalidate();
  }, [x, z, yaw, invalidate]);

  // Snap (skipped animations, first sync): jump straight to the spot.
  useLayoutEffect(() => {
    if (walk.current) return;
    const { x: tx, z: tz, yaw: ty } = target.current;
    group.current.position.set(tx, 0, tz);
    group.current.rotation.y = ty;
    invalidate();
  }, [snapNonce, invalidate]);

  // The director's handle.
  useEffect(() => {
    const g = group.current;
    const api = {
      object: g,
      walk: (path, { hop, jump }) => new Promise((resolve) => {
        walk.current?.resolve();
        // fresh: the first frame after an idle canvas carries the whole idle gap as delta; skip it.
        walk.current = { path, i: 0, t: 0, hop, jump, fresh: true, from: g.position.clone().setY(0), resolve };
        invalidate();
      }),
      finish: () => {
        const w = walk.current;
        if (!w) return;
        walk.current = null;
        g.position.set(target.current.x, 0, target.current.z);
        w.resolve();
        invalidate();
      }
    };
    registry.set(id, api);
    return () => {
      if (registry.get(id) === api) registry.delete(id);
      api.finish();
    };
  }, [id, invalidate]);

  useFrame((state, delta) => {
    const g = group.current;
    const w = walk.current;
    const dt = w?.fresh ? 0 : Math.min(delta, 0.1);
    if (w) {
      w.fresh = false;
      w.t = Math.min(1, w.t + dt / w.hop);
      const last = w.i === w.path.length - 1;
      if (last) _to.set(target.current.x, 0, target.current.z);
      else spotPosition(w.path[w.i], 0, 1, false, _to).setY(0); // in transit: the middle of each space
      g.position.lerpVectors(w.from, _to, ease(w.t));
      g.position.y = Math.sin(Math.PI * w.t) * (w.jump ? JUMP_HEIGHT : HOP_HEIGHT);
      const dx = _to.x - w.from.x;
      const dz = _to.z - w.from.z;
      if (!w.jump && dx * dx + dz * dz > 1e-4) g.rotation.y += wrapAngle(Math.atan2(dx, dz) - g.rotation.y) * Math.min(1, dt * 12);
      if (w.t >= 1) {
        w.from.copy(_to);
        w.i += 1;
        w.t = 0;
        if (w.i >= w.path.length) {
          walk.current = null;
          g.position.y = 0;
          w.resolve();
        }
      }
      state.invalidate();
      return;
    }
    // Idle: settle into the spot and turn to face along the row.
    const { x: tx, z: tz, yaw: ty } = target.current;
    const dx = tx - g.position.x;
    const dz = tz - g.position.z;
    const dy = wrapAngle(ty - g.rotation.y);
    if (dx * dx + dz * dz > 1e-6 || Math.abs(g.position.y) > 1e-3 || Math.abs(dy) > 1e-3) {
      const k = 1 - Math.exp(-10 * dt);
      g.position.x += dx * k;
      g.position.z += dz * k;
      g.position.y -= g.position.y * k;
      g.rotation.y += dy * (1 - Math.exp(-6 * dt));
      state.invalidate();
    } else if (g.position.x !== tx || g.position.z !== tz) {
      g.position.set(tx, 0, tz);
    }
  });

  return (
    <group ref={group}>
      <ErrorBoundary key={url} label={`token ${url}`} fallback={<Puck color={color} />} clearCache={() => clearTokenModel(url)}>
        <Suspense fallback={<Puck color={color} />}>
          <TokenModel url={url} color={color} />
        </Suspense>
      </ErrorBoundary>
      {current && <TurnRing color={color} />}
      {/* hit proxy: the real meshes never raycast (12k triangles each) */}
      <mesh
        position-y={0.4}
        onPointerOver={(e) => {
          if (e.pointerType !== 'mouse') return;
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          if (e.delta > CLICK_SLOP) return;
          e.stopPropagation();
          useGameStore.getState().openProperty?.(index);
        }}
      >
        <cylinderGeometry args={[0.42, 0.42, 0.8, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hovered && (
        <Html position={[0, 1.25, 0]} center pointerEvents="none" zIndexRange={[30, 0]}>
          <div className={css.label} style={{ borderColor: color }}>{name}</div>
        </Html>
      )}
    </group>
  );
});

// ---- layer ---------------------------------------------------------------------------------------------

/** Spots for every player on the board: shared spaces split into a grid, Rikers into cell vs visiting. */
function placeTokens(players, shown, jailed) {
  const groups = new Map();
  const list = [];
  for (const p of players) {
    if (p.is_bankrupt) continue;
    const index = shown[p.id] ?? p.position ?? 0;
    const inJail = index === JAIL && (jailed[p.id] ?? !!p.is_in_jail);
    const key = `${index}${inJail ? 'j' : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    const entry = { player: p, index, inJail };
    groups.get(key).push(entry);
    list.push(entry);
  }
  for (const members of groups.values()) {
    members.forEach((m, k) => {
      spotPosition(m.index, k, members.length, m.inJail, _spot);
      m.x = _spot.x;
      m.z = _spot.z;
    });
  }
  return list.map(({ player, index, x, z }) => ({
    id: player.id,
    index,
    x,
    z,
    yaw: restYaw(index),
    color: playerColor(player),
    url: tokenUrl(player.token_type),
    name: player.username
  }));
}

function Tokens() {
  const players = useGameStore(s => s.players);
  const currentId = useGameStore(s => selectCurrentPlayer(s)?.id ?? null);
  const { shown, jailed, snapNonce } = useBoardAnim(useShallow(s => ({ shown: s.shown, jailed: s.jailed, snapNonce: s.snapNonce })));
  const placed = useMemo(() => placeTokens(players || [], shown, jailed), [players, shown, jailed]);
  return placed.map(t => <Token key={t.id} {...t} current={t.id === currentId} snapNonce={snapNonce} />);
}

export default memo(Tokens);
