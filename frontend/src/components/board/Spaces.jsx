// The 40 spaces: tile art, colour bands, owner strips, houses and hotels, and the click/hover targets.
// Everything except the art is instanced (one draw call per kind) and needs no downloads, so a missing
// texture only costs its picture (each tile loads, fails and retries on its own).
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import useGameStore from '../../store/gameStore';
import { PROPERTY_COLORS } from '../../lib/board';
import { playerColor } from '../../lib/colors';
import { BOARD, CORNER, SPACES, TILE, toWorld } from './layout';
import { BOARD_URL, TILE_URLS, setupTextures, tileKey } from './assets';
import ErrorBoundary from './ErrorBoundary';

const MORTGAGED_TINT = '#8f8f8f';
const GLOW = 0.38; // landing highlight opacity
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Matrix for something at local (lx, y, lz) on space `index`, scaled (sx, sy, sz). */
function spaceMatrix(index, lx, y, lz, sx = 1, sy = 1, sz = 1) {
  toWorld(index, lx, lz, _p);
  _p.y = y;
  _q.setFromAxisAngle(UP, SPACES[index].yaw);
  return _m.compose(_p, _q, _s.set(sx, sy, sz));
}

// Flat plane lying on the board, 1 x 1, to be scaled per instance or mesh.
const groundPlane = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Free geometries this component created when it unmounts (R3F only disposes what JSX built). */
function useDispose(...resources) {
  useEffect(() => () => resources.forEach(r => r?.dispose()), resources); // eslint-disable-line react-hooks/exhaustive-deps
}

// Art rectangle for a space, in its local frame: { w, h, z }.
function artRect(space, aspect) {
  if (space.corner) return { w: CORNER - 0.15, h: CORNER - 0.15, z: 0 };
  if (space.purchasable) return { w: TILE.art, h: TILE.art, z: TILE.artZ };
  const maxW = TILE.art;
  const maxH = CORNER - 0.12;
  const h = Math.min(maxH, maxW * aspect);
  return { w: h / aspect, h, z: 0 }; // cards are 2:3: fit them into the whole space
}

// ---- art -----------------------------------------------------------------------------------------------

const ART_GEOMETRY = groundPlane();
const PLAIN_MATERIAL = new THREE.MeshStandardMaterial({ color: '#e2d6bb', roughness: 0.9 });
const ART = SPACES.map(space => ({ space, url: TILE_URLS[tileKey(space.name)] })).filter(a => a.url); // no art: the plain slab shows

function TileArt({ space, url, mortgaged }) {
  const map = useTexture(url, setupTextures);
  const aspect = map.image ? map.image.height / map.image.width : 1;
  const { w, h, z } = artRect(space, aspect);
  return (
    <group position={[space.x, 0, space.z]} rotation-y={space.yaw}>
      <mesh geometry={ART_GEOMETRY} position={[0, 0.011, z]} scale={[w, 1, h]} receiveShadow>
        <meshStandardMaterial map={map} roughness={0.85} color={mortgaged ? MORTGAGED_TINT : '#ffffff'} />
      </mesh>
    </group>
  );
}

// Fallback while a tile's art loads, or if it fails: a plain card in the same place.
function PlainTile({ space }) {
  const { w, h, z } = artRect(space, 1.49);
  return (
    <group position={[space.x, 0, space.z]} rotation-y={space.yaw}>
      <mesh geometry={ART_GEOMETRY} material={PLAIN_MATERIAL} position={[0, 0.011, z]} scale={[w, 1, h]} receiveShadow />
    </group>
  );
}

const Tile = memo(function Tile({ space, url, mortgaged }) {
  const plain = <PlainTile space={space} />;
  return (
    <ErrorBoundary label={`tile art ${space.name}`} fallback={plain} clearCache={() => useTexture.clear(url)}>
      <Suspense fallback={plain}>
        <TileArt space={space} url={url} mortgaged={mortgaged} />
      </Suspense>
    </ErrorBoundary>
  );
});

// ---- centre --------------------------------------------------------------------------------------------

const CENTER_SIZE = BOARD - 2 * CORNER - 0.3;
const clearCenterArt = () => useTexture.clear(BOARD_URL);

function CenterArt() {
  const map = useTexture(BOARD_URL, setupTextures);
  return (
    <mesh geometry={ART_GEOMETRY} position={[0, 0.011, 0]} scale={[CENTER_SIZE, 1, CENTER_SIZE]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
}

function PlainCenter() {
  return (
    <mesh geometry={ART_GEOMETRY} position={[0, 0.011, 0]} scale={[CENTER_SIZE, 1, CENTER_SIZE]} receiveShadow>
      <meshStandardMaterial color="#cfd8c8" roughness={0.9} />
    </mesh>
  );
}

export function Center() {
  return (
    <ErrorBoundary label="centre art" fallback={<PlainCenter />} clearCache={clearCenterArt}>
      <Suspense fallback={<PlainCenter />}>
        <CenterArt />
      </Suspense>
    </ErrorBoundary>
  );
}

// ---- colour bands (static) -----------------------------------------------------------------------------

const BANDED = SPACES.filter(s => s.purchasable);

function Bands() {
  const ref = useRef();
  const geometry = useMemo(() => groundPlane(), []);
  useDispose(geometry);
  useLayoutEffect(() => {
    const mesh = ref.current;
    BANDED.forEach((space, i) => {
      mesh.setMatrixAt(i, spaceMatrix(space.index, 0, 0.012, TILE.bandZ, TILE.art, 1, TILE.bandDepth));
      mesh.setColorAt(i, _c.set(PROPERTY_COLORS[space.group] ?? '#999999'));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, BANDED.length]} receiveShadow frustumCulled={false}>
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}

const BandsMemo = memo(Bands);

// ---- owners --------------------------------------------------------------------------------------------

function OwnerStrips({ ownersKey }) {
  const ref = useRef();
  const invalidate = useThree(s => s.invalidate);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useDispose(geometry);
  useLayoutEffect(() => {
    const mesh = ref.current;
    const owners = ownersKey ? ownersKey.split('|').map(entry => entry.split(':')) : [];
    mesh.setColorAt(0, _c.set('#ffffff')); // create the colour attribute before the first draw
    owners.forEach(([index, color], i) => {
      mesh.setMatrixAt(i, spaceMatrix(Number(index), 0, 0.04, TILE.ownerZ, TILE.art, 0.08, TILE.ownerDepth));
      mesh.setColorAt(i, _c.set(color));
    });
    mesh.count = owners.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [ownersKey, invalidate]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, BANDED.length]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const OwnerStripsMemo = memo(OwnerStrips);

// ---- houses and hotels ---------------------------------------------------------------------------------

// A box with a gable roof whose ridge runs along local X (along the row). Origin at the base.
function buildingGeometry(width, height, depth, roofHeight) {
  const body = new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, 0).toNonIndexed();
  const r = depth / Math.sqrt(3);
  const roof = new THREE.CylinderGeometry(r, r, width, 3, 1)
    .rotateZ(Math.PI / 2)
    .rotateX(-Math.PI / 2)
    .scale(1, roofHeight / (1.5 * r), 1)
    .toNonIndexed();
  roof.translate(0, height + roofHeight / 3, 0); // the triangle's centroid sits a third of the way up
  const merged = mergeGeometries([body, roof]);
  merged.computeVertexNormals(); // non-indexed: flat shading
  return merged;
}

const HOUSE_LIMIT = 32; // bank supply (API.md)
const HOTEL_LIMIT = 12;

function Buildings({ buildingsKey }) {
  const houses = useRef();
  const hotels = useRef();
  const invalidate = useThree(s => s.invalidate);
  const houseGeometry = useMemo(() => buildingGeometry(0.34, 0.22, 0.34, 0.16), []);
  const hotelGeometry = useMemo(() => buildingGeometry(1.0, 0.32, 0.42, 0.2), []);
  useDispose(houseGeometry, hotelGeometry);
  useLayoutEffect(() => {
    let h = 0;
    let H = 0;
    for (const entry of buildingsKey ? buildingsKey.split('|') : []) {
      const [index, count] = entry.split(':').map(Number);
      if (count >= 5) {
        if (H < HOTEL_LIMIT) hotels.current.setMatrixAt(H++, spaceMatrix(index, 0, 0.012, TILE.bandZ));
        continue;
      }
      for (let j = 0; j < count && h < HOUSE_LIMIT; j++) {
        houses.current.setMatrixAt(h++, spaceMatrix(index, (j - (count - 1) / 2) * 0.5, 0.012, TILE.bandZ));
      }
    }
    houses.current.count = h;
    hotels.current.count = H;
    houses.current.instanceMatrix.needsUpdate = true;
    hotels.current.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [buildingsKey, invalidate]);
  return (
    <>
      <instancedMesh ref={houses} args={[houseGeometry, undefined, HOUSE_LIMIT]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#2e9d4f" roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={hotels} args={[hotelGeometry, undefined, HOTEL_LIMIT]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#c8262b" roughness={0.55} />
      </instancedMesh>
    </>
  );
}

const BuildingsMemo = memo(Buildings);

// ---- click and hover targets ---------------------------------------------------------------------------

const CLICK_SLOP = 8; // px a press may move and still count as a click (not a camera drag)

function SpaceTargets() {
  const hits = useRef();
  const glow = useRef();
  const hovered = useRef(-1);
  const invalidate = useThree(s => s.invalidate);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.1, 1), []);
  const glowGeometry = useMemo(() => groundPlane(), []);
  useDispose(geometry, glowGeometry);

  useLayoutEffect(() => {
    const mesh = hits.current;
    SPACES.forEach((space, i) => mesh.setMatrixAt(i, spaceMatrix(i, 0, 0.05, 0, space.width - 0.04, 1, CORNER - 0.04)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  const hover = (index, target) => {
    if (hovered.current === index) return;
    hovered.current = index;
    const g = glow.current;
    g.visible = index >= 0;
    if (index >= 0) {
      const space = SPACES[index];
      g.matrix.copy(spaceMatrix(index, 0, 0.016, 0, space.width - 0.08, 1, CORNER - 0.08));
      g.matrixWorldNeedsUpdate = true;
    }
    if (target?.style) target.style.cursor = index >= 0 ? 'pointer' : '';
    invalidate();
  };

  return (
    <>
      <instancedMesh
        ref={hits}
        args={[geometry, undefined, SPACES.length]}
        onClick={(e) => {
          if (e.delta > CLICK_SLOP || e.instanceId == null) return;
          e.stopPropagation();
          useGameStore.getState().openProperty?.(e.instanceId);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || e.instanceId == null) return;
          hover(e.instanceId, e.nativeEvent.target);
        }}
        onPointerOut={(e) => hover(-1, e.nativeEvent.target)}
      >
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      <mesh ref={glow} geometry={glowGeometry} matrixAutoUpdate={false} visible={false} renderOrder={1}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---- landing highlight ---------------------------------------------------------------------------------

export function LandingGlow({ landing, color }) {
  const ref = useRef();
  const started = useRef(-1);
  const geometry = useMemo(() => groundPlane(), []);
  useDispose(geometry);
  const invalidate = useThree(s => s.invalidate);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!landing) {
      mesh.visible = false; // reset (new game) mid-glow
      invalidate();
      return;
    }
    const space = SPACES[landing.position];
    if (!space) return;
    mesh.matrix.copy(spaceMatrix(landing.position, 0, 0.015, 0, space.width - 0.06, 1, CORNER - 0.06));
    mesh.matrixWorldNeedsUpdate = true;
    mesh.material.color.set(color || '#ffffff');
    started.current = -1;
    invalidate();
  }, [landing, color, invalidate]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!landing || !mesh) return;
    const now = state.clock.elapsedTime;
    if (started.current < 0) started.current = now;
    const t = now - started.current;
    const opacity = t < 0.25 ? (t / 0.25) * GLOW : t < 2.6 ? GLOW : Math.max(0, GLOW * (1 - (t - 2.6) / 0.6));
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.001;
    if (t < 3.3) state.invalidate();
  });

  return (
    <mesh ref={ref} geometry={geometry} matrixAutoUpdate={false} visible={false} renderOrder={1}>
      <meshBasicMaterial transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---- the layer -----------------------------------------------------------------------------------------

/** Derived keys are strings so the instanced children only redo their work when something changed. */
function deriveKeys(properties, players) {
  const colorById = new Map(players.map(p => [p.id, playerColor(p)]));
  const mortgaged = [];
  const owners = [];
  const buildings = [];
  for (const p of properties) {
    const index = p.position_on_board;
    if (!SPACES[index]) continue;
    if (p.is_mortgaged) mortgaged.push(index);
    if (p.owner_id != null) owners.push(`${index}:${colorById.get(p.owner_id) ?? '#b0b8b4'}`);
    if (p.house_count > 0) buildings.push(`${index}:${p.house_count}`);
  }
  return { mortgagedKey: mortgaged.join(','), ownersKey: owners.join('|'), buildingsKey: buildings.join('|') };
}

function Spaces() {
  const properties = useGameStore(s => s.properties);
  const players = useGameStore(s => s.players);
  const { mortgagedKey, ownersKey, buildingsKey } = useMemo(() => deriveKeys(properties || [], players || []), [properties, players]);
  const mortgaged = useMemo(() => new Set(mortgagedKey ? mortgagedKey.split(',').map(Number) : []), [mortgagedKey]);
  return (
    <>
      {ART.map(({ space, url }) => <Tile key={space.index} space={space} url={url} mortgaged={mortgaged.has(space.index)} />)}
      <BandsMemo />
      <OwnerStripsMemo ownersKey={ownersKey} />
      <BuildingsMemo buildingsKey={buildingsKey} />
      <SpaceTargets />
    </>
  );
}

export default memo(Spaces);
