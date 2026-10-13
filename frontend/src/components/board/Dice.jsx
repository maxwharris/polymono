// Two 3D dice. They rest on the board showing the last roll; a 'roll' event (through the director) throws
// them from the roller's side to the middle, and they land exactly on the server's values.
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import useBoardAnim from '../../store/boardAnim';
import { SPACES } from './layout';
import { ROLL_SECONDS } from './director';
import { dice as registry } from './registry';

const SIZE = 0.9;
const REST = [new THREE.Vector3(-0.75, SIZE / 2, 5.0), new THREE.Vector3(0.8, SIZE / 2, 5.45)];
const REST_YAW = [0.35, -0.2];

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z. Opposite faces add up to 7.
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
// Rotation that brings each value to the top (+Y).
const TO_TOP = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2)
};
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.24], [0.73, 0.24], [0.27, 0.5], [0.73, 0.5], [0.27, 0.76], [0.73, 0.76]]
};

const UP = new THREE.Vector3(0, 1, 0);
const _yaw = new THREE.Quaternion();
const _spin = new THREE.Quaternion();

function faceQuaternion(value, yaw, out) {
  out.setFromEuler(TO_TOP[value] ?? TO_TOP[1]);
  return out.premultiply(_yaw.setFromAxisAngle(UP, yaw));
}

function pipTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f6f1e4';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = value === 1 ? '#c8262b' : '#1b1b1b';
  for (const [u, v] of PIPS[value]) {
    g.beginPath();
    g.arc(u * 128, v * 128, value === 1 ? 17 : 11.5, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Dice() {
  const dice = useBoardAnim(s => s.dice);
  const left = useRef();
  const right = useRef();
  const anim = useRef(null);
  const invalidate = useThree(s => s.invalidate);
  const geometry = useMemo(() => new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.12), []);
  const materials = useMemo(
    () => FACE_VALUES.map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.45 })),
    []
  );
  useEffect(() => () => {
    geometry.dispose();
    materials.forEach(m => {
      m.map.dispose();
      m.dispose();
    });
  }, [geometry, materials]);

  const die1 = dice?.die1;
  const die2 = dice?.die2;
  const visible = !!die1;

  // At rest: show the latest values (first load, skipped animations).
  useLayoutEffect(() => {
    if (anim.current || !die1) return;
    [left.current, right.current].forEach((d, i) => {
      d.position.copy(REST[i]);
      faceQuaternion(i ? die2 : die1, REST_YAW[i], d.quaternion);
    });
    invalidate();
  }, [die1, die2, invalidate]);

  useEffect(() => {
    const meshes = [left.current, right.current];
    const api = {
      roll: (v1, v2, fromIndex) => new Promise((resolve) => {
        anim.current?.resolve();
        const space = SPACES[fromIndex] ?? SPACES[0];
        const start = new THREE.Vector3(space.x * 0.75, 3, space.z * 0.75);
        anim.current = {
          t: 0,
          resolve,
          parts: [v1, v2].map((value, i) => {
            const yaw = (Math.random() - 0.5) * 1.2 + REST_YAW[i];
            const to = REST[i].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
            return {
              from: start.clone().add(new THREE.Vector3(i ? 0.6 : -0.6, 0, 0)),
              to,
              target: faceQuaternion(value, yaw, new THREE.Quaternion()),
              axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
            };
          })
        };
        invalidate();
      }),
      finish: () => {
        const a = anim.current;
        if (!a) return;
        anim.current = null;
        a.parts.forEach((p, i) => {
          meshes[i].position.copy(p.to);
          meshes[i].quaternion.copy(p.target);
        });
        a.resolve();
        invalidate();
      }
    };
    registry.current = api;
    return () => {
      if (registry.current === api) registry.current = null;
      api.finish();
    };
  }, [invalidate]);

  useFrame((state, delta) => {
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(1, a.t + Math.min(delta, 0.1) / ROLL_SECONDS);
    const t = a.t;
    const travel = 1 - (1 - t) ** 2;
    const bounce = 3 * (1 - t) ** 2 * Math.abs(Math.cos(t * 2.5 * Math.PI)); // two decaying bounces
    const meshes = [left.current, right.current];
    a.parts.forEach((p, i) => {
      const d = meshes[i];
      d.position.lerpVectors(p.from, p.to, travel);
      d.position.y = SIZE / 2 + bounce;
      _spin.setFromAxisAngle(p.axis, (1 - travel) * 4 * Math.PI);
      d.quaternion.multiplyQuaternions(_spin, p.target);
    });
    if (t >= 1) {
      anim.current = null;
      a.resolve();
    }
    state.invalidate();
  });

  return (
    <>
      <mesh ref={left} geometry={geometry} material={materials} castShadow visible={visible} />
      <mesh ref={right} geometry={geometry} material={materials} castShadow visible={visible} />
    </>
  );
}

export default memo(Dice);
