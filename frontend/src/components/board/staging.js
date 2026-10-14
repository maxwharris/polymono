// Baked staging (Midnight Deco): textures drawn once on a canvas, so the room costs nothing per frame.
//
// - tableTexture: the night-navy lacquer table with the lamp pool baked in (no real-time spotlight: with
//   frameloop="demand" on phones, and so a warm light can't wash out the cream tiles), a faint brass fan inlay
//   radiating from the centre, and a soft contact shadow under the slab.
// - hatchTexture: the diagonal hatch laid over a mortgaged tile's art.
import * as THREE from 'three';
import { SLAB } from './layout';

/** The room colour: the scene background and the table at its far edge, so the two meet without a seam. */
export const ROOM = '#0A1120';

/** World units the table texture covers (the table plane's size). Beyond it is the background, same colour. */
export const TABLE_SPAN = 120;

const TABLE_PX = 1024;
const BRASS = [215, 180, 106]; // --brass-400

// Lacquer falloff, by distance from the centre in world units (the slab's edge is at 15.5, its corner 21.9;
// a phone or desktop overview sees out to about 30). It bottoms out at --table-edge's depth, then eases back
// to the room colour at the far edge, which only shows as a sliver at the horizon when the view is tilted.
const TABLE_STOPS = [
  [0, '#10203F'],
  [16, '#0E1A33'],
  [23, '#0B1529'],
  [31, '#08101F'],
  [40, '#070C19'],
  [52, '#090F1D'],
  [58, ROOM],
  [60, ROOM]
];

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

/** Half a step of noise per channel, so the slow navy gradients don't band in 8 bits. */
function dither(g, size) {
  const image = g.getImageData(0, 0, size, size);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = Math.random() - 0.5;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(image, 0, 0);
}

export function tableTexture() {
  const size = TABLE_PX;
  const k = size / TABLE_SPAN; // px per world unit
  const c = size / 2;
  const [canvas, g] = canvas2d(size, size);

  // Lacquer, falling off from the lamp to the room.
  const base = g.createRadialGradient(c, c, 0, c, c, c);
  for (const [r, color] of TABLE_STOPS) base.addColorStop(Math.min(1, r / (TABLE_SPAN / 2)), color);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  // The lamp pool: warm brass light on the lacquer around the board.
  const lamp = g.createRadialGradient(c, c, 0, c, c, 34 * k);
  lamp.addColorStop(0, rgba(BRASS, 0.1));
  lamp.addColorStop(0.5, rgba(BRASS, 0.055));
  lamp.addColorStop(0.75, rgba(BRASS, 0.02));
  lamp.addColorStop(1, rgba(BRASS, 0));
  g.fillStyle = lamp;
  g.fillRect(0, 0, size, size);

  // A Deco fan inlay: thin brass rays every 15 degrees, fading out with the lamp.
  const [rays, rg] = canvas2d(size, size);
  rg.fillStyle = rgba(BRASS, 0.035);
  const ray = THREE.MathUtils.degToRad(1);
  for (let a = 0; a < 360; a += 15) {
    const from = THREE.MathUtils.degToRad(a + 7.5); // between the board's corners and its edge midpoints
    rg.beginPath();
    rg.moveTo(c, c);
    rg.arc(c, c, c, from - ray / 2, from + ray / 2);
    rg.closePath();
    rg.fill();
  }
  const fade = rg.createRadialGradient(c, c, 0, c, c, 42 * k);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(17 / 42, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  rg.globalCompositeOperation = 'destination-in';
  rg.fillStyle = fade;
  rg.fillRect(0, 0, size, size);
  g.drawImage(rays, 0, 0);

  // Contact shadow under the slab: drawn off-canvas so only its blurred shadow lands (canvas y = world +z;
  // the key light is at +x +z, so the shadow leans a little to -x -z).
  const slab = SLAB * k;
  const away = size * 2;
  g.save();
  g.fillStyle = '#000';
  for (const [blur, alpha, grow] of [[30, 0.6, 1.2], [6, 0.75, 0.2]]) {
    const s = slab + grow * k;
    g.shadowColor = `rgba(1, 3, 9, ${alpha})`;
    g.shadowBlur = blur;
    g.shadowOffsetX = away - 0.25 * k;
    g.shadowOffsetY = 0 - 0.3 * k;
    g.fillRect(c - s / 2 - away, c - s / 2, s, s);
  }
  g.restore();

  dither(g, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Diagonal hatch for mortgaged tiles: navy lines on transparent, tiling seamlessly. */
export function hatchTexture() {
  const size = 64;
  const period = 16;
  const [canvas, g] = canvas2d(size, size);
  g.strokeStyle = 'rgba(16, 26, 45, 1)';
  g.lineWidth = 4.5;
  for (let n = -size / period; n <= size / period; n++) {
    g.beginPath();
    g.moveTo(n * period - 4, -4);
    g.lineTo(n * period + size + 4, size + 4);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
