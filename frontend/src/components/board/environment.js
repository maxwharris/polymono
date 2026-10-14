// A zero-download environment map for the metal on the board: the tokens, their pucks and the slab's brass
// inlay (the tiles keep plain lighting). A lost-and-restored WebGL context empties it, because it only
// ever lived on the GPU: useEnvironment hands out a fresh one after a restore, so materials built from it
// (useMemo on the returned map) are rebuilt too.
import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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

/** Counts WebGL context restores (iOS drops the context in the background), after dropping the stale map. */
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

/** The environment map for this canvas; a new one after a context restore. */
export function useEnvironment() {
  const gl = useThree(s => s.gl);
  const restores = useContextRestores(gl);
  return useMemo(() => environmentFor(gl), [gl, restores]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The slab's brass inlay, from the design's #C9A35A. */
export function brassMaterial(envMap) {
  return new THREE.MeshStandardMaterial({ color: '#C9A35A', metalness: 0.8, roughness: 0.35, envMap, envMapIntensity: 1 });
}
