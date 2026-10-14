// Player tokens. Each token is one long-lived group keyed by player id (never remounted when it moves), placed
// from boardAnim.shown rather than players[].position, and walked space by space by the director.
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import useGameStore, { selectCurrentPlayer } from '../../store/gameStore';
import useBoardAnim from '../../store/boardAnim';
import { playerColor } from '../../lib/colors';
import { JAIL, restYaw, spotPosition, spotScale } from './layout';
import { clearTokenModel, tokenUrl, useTokenModel } from './assets';
import { tokens as registry } from './registry';
import { useEnvironment } from './environment';
import { useReducedMotion } from './motion';
import ErrorBoundary from './ErrorBoundary';
import css from './board.module.css';

const SCALE = 0.48; // models are ~1.9 long: 0.9 on the board
const HOP_HEIGHT = 0.55;
const JUMP_HEIGHT = 4;
const CLICK_SLOP = 8;
// The base every piece stands on: a brass-topped puck with a player-coloured rim, so a piece reads as a piece on
// busy art and its colour shows from straight above.
const PUCK_R = 0.44;
const PUCK_H = 0.07;
const RING_IN = 0.5; // the turn ring, outside the puck
const RING_OUT = 0.62;
const HAIRLINE = 0.035; // brass, outside the turn ring
const BRASS_LINE = '#D7B46A'; // --brass-400
const BRASS_PUCK = '#B08A3C'; // a deeper brass than the inlay: it sits on cream tiles, under a white environment

// On a small canvas the whole-board overview draws a piece about 11px across, lost on the art. Pieces grow
// there, to about 15px at 375px wide (at most 1.4 times), and shared spots spread out to fit them
// (layout.js: spotScale). Canvases from about 550px wide, the desktop board among them, keep scale 1. It follows
// the width only, so a turn panel changing the canvas height never resizes the pieces.
const MAX_PIECE_SCALE = 1.4;
const pieceScaleFor = width => Math.min(MAX_PIECE_SCALE, Math.max(1, Math.round((528 / Math.max(1, width - 20)) * 20) / 20));

const noRaycast = () => null;
const _to = new THREE.Vector3();
const _spot = new THREE.Vector3();

const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---- shared resources ----------------------------------------------------------------------------------

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

// ---- parts ---------------------------------------------------------------------------------------------

function TokenModel({ url, color }) {
  const { scene } = useTokenModel(url);
  const env = useEnvironment();
  const geometries = useMemo(() => geometriesOf(scene), [scene]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32, envMap: env, envMapIntensity: 0.9 }),
    [color, env]
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group scale={SCALE} position-y={PUCK_H}>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} castShadow raycast={noRaycast} />
      ))}
    </group>
  );
}

// Stands in for the model while it loads, or if it fails: a plain pawn in the player's colour.
function Pawn({ color }) {
  return (
    <mesh position-y={PUCK_H + 0.14} castShadow raycast={noRaycast}>
      <cylinderGeometry args={[0.24, 0.3, 0.28, 24]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

// The puck in one draw call: vertex colours paint the side in the player's colour and the top in brass, under
// one metal material (the bottom cap is dropped: it is never seen).
const PUCK_SEGMENTS = 40;
const _rim = new THREE.Color();
const _brass = new THREE.Color(BRASS_PUCK);

function puckGeometry(color) {
  const g = new THREE.CylinderGeometry(PUCK_R, PUCK_R + 0.02, PUCK_H, PUCK_SEGMENTS).translate(0, PUCK_H / 2, 0);
  const [, top] = g.groups; // torso, top cap, bottom cap
  g.setIndex(Array.from(g.index.array).slice(0, top.start + top.count));
  g.clearGroups();
  const torso = 2 * (PUCK_SEGMENTS + 1); // the torso's vertices come first
  _rim.set(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) (i < torso ? _rim : _brass).toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

// The bold puck, for small canvases, where a piece is about 15px across and the plain one melts into the cream
// art: the same footprint, but the side tapers so it shows from above, in a dark shade of the player's colour
// (an outline, as on the owners' discs), and the top carries a band of their colour round the brass.
const BOLD_TOP_R = 0.39;
const BOLD_BAND = 0.1;
const _band = new THREE.Color();
const _hsl = {};

function paint(geometry, color) {
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < geometry.attributes.position.count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function boldPuckGeometry(color) {
  _band.set(color).getHSL(_hsl);
  _rim.setHSL(_hsl.h, Math.min(1, _hsl.s * 0.9), _hsl.l * 0.42); // Spaces.jsx: rimColor
  const flat = g => g.rotateX(-Math.PI / 2).translate(0, PUCK_H, 0);
  const parts = [
    paint(new THREE.CylinderGeometry(BOLD_TOP_R, PUCK_R + 0.02, PUCK_H, PUCK_SEGMENTS, 1, true).translate(0, PUCK_H / 2, 0), _rim),
    paint(flat(new THREE.RingGeometry(BOLD_TOP_R - BOLD_BAND, BOLD_TOP_R, PUCK_SEGMENTS)), _band),
    paint(flat(new THREE.CircleGeometry(BOLD_TOP_R - BOLD_BAND, PUCK_SEGMENTS)), _brass)
  ];
  const g = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return g;
}

function Base({ color, bold }) {
  const env = useEnvironment();
  const geometry = useMemo(() => (bold ? boldPuckGeometry(color) : puckGeometry(color)), [color, bold]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.36, envMap: env, envMapIntensity: 0.9 }),
    [env]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // Too thin to cast a shadow worth a draw; the model above it casts one onto it.
  return <mesh geometry={geometry} material={material} receiveShadow raycast={noRaycast} />;
}

// Under the player whose turn it is, in their colour with a brass outer hairline; pulses for two seconds when
// the turn starts (not with reduced motion).
function TurnRing({ color }) {
  const ref = useRef();
  const started = useRef(-1);
  const still = useReducedMotion();
  useFrame((state) => {
    if (still) return;
    const now = state.clock.elapsedTime;
    if (started.current < 0) started.current = now;
    const t = now - started.current;
    const k = t < 2 ? 1 + 0.22 * Math.sin(t * Math.PI * 3) * (1 - t / 2) : 1;
    ref.current.scale.set(k, k, 1);
    if (t < 2.1) state.invalidate();
  });
  return (
    <group ref={ref} rotation-x={-Math.PI / 2} position-y={0.02}>
      <mesh raycast={noRaycast} renderOrder={2}>
        <ringGeometry args={[RING_IN, RING_OUT, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh raycast={noRaycast} renderOrder={2}>
        <ringGeometry args={[RING_OUT + 0.012, RING_OUT + 0.012 + HAIRLINE, 48]} />
        <meshBasicMaterial color={BRASS_LINE} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---- token ---------------------------------------------------------------------------------------------

const Token = memo(function Token({ id, index, x, z, yaw, scale, bold, color, url, name, current, snapNonce }) {
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
      <group scale={scale}>
        <Base color={color} bold={bold} />
        <ErrorBoundary key={url} label={`token ${url}`} fallback={<Pawn color={color} />} clearCache={() => clearTokenModel(url)}>
          <Suspense fallback={<Pawn color={color} />}>
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
            <div className={css.label} style={{ '--pc': color }}>{name}</div>
          </Html>
        )}
      </group>
    </group>
  );
});

// ---- layer ---------------------------------------------------------------------------------------------

/**
 * Spots for every player on the board: shared spaces split into a grid, Rikers into cell vs visiting. `want` is
 * the piece scale for the canvas; a crowded spot may give its pieces less.
 */
function placeTokens(players, shown, jailed, want) {
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
    const { index, inJail } = members[0];
    const scale = spotScale(index, members.length, inJail, want);
    members.forEach((m, k) => {
      spotPosition(m.index, k, members.length, m.inJail, _spot, scale);
      m.x = _spot.x;
      m.z = _spot.z;
      m.scale = scale;
    });
  }
  return list.map(({ player, index, x, z, scale }) => ({
    id: player.id,
    index,
    x,
    z,
    yaw: restYaw(index),
    scale,
    color: playerColor(player),
    url: tokenUrl(player.token_type),
    name: player.username
  }));
}

function Tokens() {
  const players = useGameStore(s => s.players);
  const currentId = useGameStore(s => selectCurrentPlayer(s)?.id ?? null);
  const { shown, jailed, snapNonce } = useBoardAnim(useShallow(s => ({ shown: s.shown, jailed: s.jailed, snapNonce: s.snapNonce })));
  const want = pieceScaleFor(useThree(s => s.size.width));
  const placed = useMemo(() => placeTokens(players || [], shown, jailed, want), [players, shown, jailed, want]);
  return placed.map(t => <Token key={t.id} {...t} bold={want > 1} current={t.id === currentId} snapNonce={snapNonce} />);
}

export default memo(Tokens);
