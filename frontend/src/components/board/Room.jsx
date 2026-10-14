// The room the board sits in (Midnight Deco "board staging"): lights, the night-navy table with its baked
// lamp pool, and the slab: lacquer sides, a cream top under the tiles, and a brass inlay ring round the top edge.
import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SLAB, SLAB_HEIGHT } from './layout';
import { ROOM, TABLE_SPAN, tableTexture } from './staging';
import { brassMaterial, useEnvironment } from './environment';

const noRaycast = () => null;

// Hemisphere: warm sky, cool night ground (not green). Key: warm, same place, casts the shadows. Rim: a cool
// light from behind and above that gives the metal tokens a night edge; it is low, so it barely touches the
// cream tiles (NeutralToneMapping keeps them cream: no warm spotlight on top of the key).
function Lights() {
  return (
    <>
      <hemisphereLight args={['#FFF5E6', '#1A2236', 1.15]} />
      <directionalLight
        color="#FFF1DC"
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
      <directionalLight color="#7FA6FF" position={[-10, 12, -30]} intensity={0.35} />
    </>
  );
}

// Unlit on purpose: the lamp is baked into the texture, and toneMapped=false keeps the navy exactly as drawn
// (NeutralToneMapping's toe would otherwise strip the red out of it). It meets the background colour at its edge.
function Table() {
  const map = useMemo(() => tableTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-SLAB_HEIGHT - 0.02} raycast={noRaycast}>
      <planeGeometry args={[TABLE_SPAN, TABLE_SPAN]} />
      <meshBasicMaterial map={map} toneMapped={false} dithering />
    </mesh>
  );
}

const INLAY_WIDTH = 0.13; // on the top face
const INLAY_HEIGHT = 0.06; // down the sides
const INLAY_PROUD = 0.012; // stands this far out of the slab, so the lacquer never shows through

/** Four bars round the top edge of the slab, merged into one mesh. */
function inlayGeometry() {
  const outer = SLAB + 2 * INLAY_PROUD;
  const height = INLAY_HEIGHT + INLAY_PROUD;
  const y = -INLAY_HEIGHT + height / 2;
  const edge = outer / 2 - INLAY_WIDTH / 2;
  const bars = [
    new THREE.BoxGeometry(outer, height, INLAY_WIDTH).translate(0, y, edge),
    new THREE.BoxGeometry(outer, height, INLAY_WIDTH).translate(0, y, -edge),
    new THREE.BoxGeometry(INLAY_WIDTH, height, outer - 2 * INLAY_WIDTH).translate(edge, y, 0),
    new THREE.BoxGeometry(INLAY_WIDTH, height, outer - 2 * INLAY_WIDTH).translate(-edge, y, 0)
  ];
  const merged = mergeGeometries(bars);
  bars.forEach(b => b.dispose());
  return merged;
}

/** The slab's four lacquer sides: a box without its top (the cream top covers it) or bottom (never seen). */
function sidesGeometry() {
  const box = new THREE.BoxGeometry(SLAB, SLAB_HEIGHT, SLAB).translate(0, -SLAB_HEIGHT / 2, 0);
  const index = Array.from(box.index.array);
  box.setIndex([...index.slice(0, 12), ...index.slice(24, 36)]); // faces +X, -X, +Z, -Z (6 indices each)
  box.clearGroups();
  return box;
}

function Slab() {
  const env = useEnvironment();
  const sides = useMemo(() => sidesGeometry(), []);
  const inlay = useMemo(() => inlayGeometry(), []);
  const brass = useMemo(() => brassMaterial(env), [env]);
  useEffect(() => () => [sides, inlay].forEach(g => g.dispose()), [sides, inlay]);
  useEffect(() => () => brass.dispose(), [brass]);
  return (
    <>
      <mesh geometry={sides} raycast={noRaycast}>
        <meshStandardMaterial color="#18233D" roughness={0.38} metalness={0.1} envMap={env} envMapIntensity={0.35} />
      </mesh>
      {/* the cream top under the tiles */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[SLAB, SLAB]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.9} />
      </mesh>
      <mesh geometry={inlay} material={brass} raycast={noRaycast} />
    </>
  );
}

function Room() {
  return (
    <>
      <color attach="background" args={[ROOM]} />
      <Lights />
      <Table />
      <Slab />
    </>
  );
}

export default memo(Room);
