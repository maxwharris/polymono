// Board geometry: where the 40 spaces are, where tokens stand on them, and the paths they walk.
//
// World units: the board is 30 x 30, centred on the origin, lying on y = 0 (the top of the slab).
// Space 0 (New Year's Eve) is the bottom-right corner as seen from the default camera (+Z), and play runs
// clockwise: bottom row right to left, left column bottom to top, top row, right column.
//
// Every space has a local frame: rotate by `yaw` about Y and local +Z points out of the board, local -Z
// towards its centre, and local -X is the direction of travel.
import * as THREE from 'three';
import { SPACES as SPACE_INFO, JAIL_POSITION } from '../../lib/board';

export const BOARD = 30;
export const CORNER = 3.5;
export const CELL = (BOARD - 2 * CORNER) / 9;
export const SLAB = BOARD + 1;
export const SLAB_HEIGHT = 0.4;
export const JAIL = JAIL_POSITION;

const H = BOARD / 2;
const EDGE = H - CORNER / 2;
const SIDE_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

export const SPACES = Array.from({ length: 40 }, (_, i) => {
  const side = Math.floor(i / 10);
  const k = i % 10;
  const along = k === 0 ? EDGE : H - CORNER - (k - 0.5) * CELL;
  const [x, z] = [[along, EDGE], [-EDGE, along], [-along, -EDGE], [EDGE, -along]][side];
  const info = SPACE_INFO[i];
  const purchasable = ['property', 'railroad', 'utility'].includes(info.kind);
  return {
    index: i,
    x,
    z,
    side,
    yaw: SIDE_YAW[side],
    corner: k === 0,
    width: k === 0 ? CORNER : CELL,
    name: info.name,
    kind: info.kind,
    group: info.kind === 'property' ? info.group : purchasable ? info.kind : null,
    purchasable
  };
});

// Layout inside a purchasable space (local frame): the colour band at the inner edge, the art below it,
// the owner strip along the outer edge.
export const TILE = {
  art: CELL - 0.12,
  artZ: 0.35,
  bandZ: -CORNER / 2 + 0.38,
  bandDepth: 0.62,
  ownerZ: CORNER / 2 - 0.09,
  ownerDepth: 0.16
};

/** Local (lx, lz) on space `index` to world, into `out` (a Vector3, y untouched). */
export function toWorld(index, lx, lz, out) {
  const s = SPACES[index];
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  out.x = s.x + lx * c + lz * sn;
  out.z = s.z - lx * sn + lz * c;
  return out;
}

// ---- token spots ---------------------------------------------------------------------------------------

// Offsets for n tokens sharing a spot, spaced dx apart across and dz apart along the space.
function arrange(n, dx, dz) {
  switch (n) {
    case 1: return [[0, 0]];
    case 2: return [[-dx / 2, 0], [dx / 2, 0]];
    case 3: return [[-dx / 2, -dz / 2], [dx / 2, -dz / 2], [0, dz / 2]];
    case 4: return [[-dx / 2, -dz / 2], [dx / 2, -dz / 2], [-dx / 2, dz / 2], [dx / 2, dz / 2]];
    default: {
      const rows = [[-dx / 2, -dz], [dx / 2, -dz], [-dx / 2, 0], [dx / 2, 0], [-dx / 2, dz], [dx / 2, dz]];
      return rows.slice(0, Math.min(6, n));
    }
  }
}

// Rikers: "just visiting" tokens stand on the outer L of the corner, prisoners in the inner cell.
// Local frame of space 10: +Z is the left outer edge, +X the bottom outer edge.
const VISITING = [[1.35, 1.35], [0.2, 1.4], [1.4, 0.2], [-0.95, 1.4], [1.4, -0.95], [-1.45, 0.75]];
const CELL_CENTER = [-0.6, -0.6];

/** Where token `k` of `n` on a spot stands, in world x/z. `jailed` only matters on Rikers. */
export function spotPosition(index, k, n, jailed, out) {
  const s = SPACES[index];
  if (index === JAIL && !jailed) {
    const [lx, lz] = VISITING[k % VISITING.length];
    return toWorld(index, lx, lz, out);
  }
  if (index === JAIL) {
    const [ox, oz] = arrange(n, 0.85, 0.7)[k] ?? [0, 0];
    return toWorld(index, CELL_CENTER[0] + ox, CELL_CENTER[1] + oz, out);
  }
  if (s.corner) {
    const [ox, oz] = arrange(n, 1.4, 1.0)[k] ?? [0, 0];
    return toWorld(index, ox, oz, out);
  }
  const center = s.purchasable ? TILE.artZ : 0.1;
  const [ox, oz] = arrange(n, 1.2, n > 4 ? 0.9 : 0.95)[k] ?? [0, 0];
  return toWorld(index, ox, center + oz, out);
}

/** Facing for a token at rest: the direction of travel along its row (models face +Z). */
export function restYaw(index) {
  const s = SPACES[index];
  return s.yaw - Math.PI / 2;
}

/**
 * Spaces visited by a move, in order, ending on `to`. Uses the sign of `steps` (negative for 'back');
 * never infer the direction from positions (0 -> 38 would walk backwards). 'jail' is a single jump.
 */
export function walkPath({ from, to, steps, kind }) {
  if (kind === 'jail') return [to ?? JAIL];
  let n = Number.isFinite(steps) ? steps : (((to - from) % 40) + 40) % 40;
  if (n === 0) return from === to ? [] : [to];
  const dir = Math.sign(n);
  n = Math.abs(n);
  const path = Array.from({ length: n }, (_, i) => (((from + dir * (i + 1)) % 40) + 40) % 40);
  if (Number.isInteger(to) && path[path.length - 1] !== to) path.push(to); // the server knows best
  return path;
}

export const SLAB_BOX = new THREE.Box3(new THREE.Vector3(-SLAB / 2, -SLAB_HEIGHT, -SLAB / 2), new THREE.Vector3(SLAB / 2, 0.2, SLAB / 2));
