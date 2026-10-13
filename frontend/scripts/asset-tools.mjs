// Node helpers for scripts/optimize-assets.sh. Not part of the app and not installed by package.json:
// optimize-assets.sh installs the dependencies into a scratch folder and copies this file next to them.
//
//   node asset-tools.mjs lowpoly <in.glb> <out.glb> <targetTriangles>
//     The source tokens are ~500k triangles with hard-edge split normals, which stop the gltf-transform CLI
//     simplifier at 18-133k triangles. This drops normals/tangents/uvs (the models are untextured), welds,
//     simplifies to the target, recomputes smooth normals and Draco-compresses. The board re-creases the
//     normals client-side (toCreasedNormals) so hard edges stay crisp.
//
//   node asset-tools.mjs icon <logo.png> <out.png> <size>
//     Square app icon: the puzzle-piece "C" from the logo with the wordmark painted out.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, weld, simplify, draco, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [, , cmd, ...args] = process.argv;

async function lowpoly(inp, out, target) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule()
  });
  const doc = await io.read(inp);
  let before = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      before += prim.getIndices().getCount() / 3;
      for (const semantic of ['NORMAL', 'TANGENT', 'TEXCOORD_0']) if (prim.getAttribute(semantic)) prim.setAttribute(semantic, null);
    }
  }
  await doc.transform(prune(), weld());
  await MeshoptSimplifier.ready;
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, Number(target) / before), error: 0.01 }));

  // Area-weighted smooth normals.
  let after = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const index = prim.getIndices().getArray();
      const normals = new Float32Array(pos.getCount() * 3);
      const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
      after += index.length / 3;
      for (let i = 0; i < index.length; i += 3) {
        pos.getElement(index[i], a);
        pos.getElement(index[i + 1], b);
        pos.getElement(index[i + 2], c);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [index[i], index[i + 1], index[i + 2]]) {
          normals[k * 3] += nx;
          normals[k * 3 + 1] += ny;
          normals[k * 3 + 2] += nz;
        }
      }
      for (let k = 0; k < normals.length; k += 3) {
        const len = Math.hypot(normals[k], normals[k + 1], normals[k + 2]) || 1;
        normals[k] /= len;
        normals[k + 1] /= len;
        normals[k + 2] /= len;
      }
      prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(pos.getBuffer()));
    }
  }
  await doc.transform(dedup(), prune(), draco());
  await io.write(out, doc);
  console.log(`${inp.split('/').pop()}: ${before} -> ${after} triangles`);
}

// Pixel boxes measured on art/polymono-logo.png (2816x1536). Re-measure if the logo art changes.
async function icon(logo, out, size) {
  const white = (left, top, width, height) => ({ input: { create: { width, height, channels: 3, background: '#ffffff' } }, left, top });
  const masked = await sharp(logo).removeAlpha()
    .composite([white(440, 520, 660, 345), white(440, 520, 320, 410)]) // the wordmark inside the C
    .png().toBuffer();
  const crop = { left: 150, top: 190, width: 870, height: 1110 }; // the C, without "A Property Trading Game"
  const emblem = await sharp(masked).extract(crop).png().toBuffer();
  const side = 1240;
  const square = await sharp({ create: { width: side, height: side, channels: 3, background: '#ffffff' } })
    .composite([{ input: emblem, left: Math.round((side - crop.width) / 2), top: Math.round((side - crop.height) / 2) }])
    .png().toBuffer();
  await sharp(square).resize(Number(size), Number(size)).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${out}: ${size}x${size}`);
}

if (cmd === 'lowpoly') await lowpoly(...args);
else if (cmd === 'icon') await icon(...args);
else {
  console.error('usage: asset-tools.mjs lowpoly <in.glb> <out.glb> <tris> | icon <logo.png> <out.png> <size>');
  process.exit(1);
}
