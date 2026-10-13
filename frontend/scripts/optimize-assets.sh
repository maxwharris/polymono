#!/bin/bash
# Regenerates the shipped board assets from the source art. Run on a Mac, from anywhere:
#   frontend/scripts/optimize-assets.sh            # everything
#   frontend/scripts/optimize-assets.sh textures   # or: logo | tokens | draco
# then commit the results. Nothing here runs at build or deploy time.
#
#   art/              source material, NOT served (2048px PNGs, 500k-triangle GLBs, the 2816px logo)
#   src/assets/board  36 tiles at 512px wide webp (q80; the two card tiles keep their 2:3 shape) and the
#                     centre art at 2048 (q82). Imported with import.meta.glob(..., { query: '?url' }) in
#                     components/board/assets.js, so Vite fingerprints them and they can be cached forever.
#   src/assets/tokens the six tokens: ~12k triangles, Draco-compressed (scripts/asset-tools.mjs lowpoly).
#   public/polymono-logo.webp  336px wide (Login shows it at 168 CSS px, so 2x)
#   public/icon-192.png        app icon: the puzzle "C" from the logo
#   public/draco/      the Draco decoder (wasm + wrapper) copied from three, so tokens load without a CDN
#
# Measured (Oct 2026): tiles 268 MB of PNG -> ~1 MB of webp, centre 9 MB -> ~1 MB, tokens 137 MB -> ~0.25 MB,
# logo 4.3 MB -> ~10 KB. See the graphics review for the reasoning behind each number.
#
# Requires cwebp (brew install webp) and node/npm. The token and icon steps install @gltf-transform,
# meshoptimizer, draco3dgltf and sharp into a cache folder outside the repo ($ASSET_TOOLS).
set -euo pipefail
cd "$(dirname "$0")/.."

ART=art
OUT=src/assets
TOKENS="taxi pigeon rat subway bull empire"
TOKEN_TRIANGLES=12000
ASSET_TOOLS="${ASSET_TOOLS:-${TMPDIR:-/tmp}/polymono-asset-tools}"
STEP="${1:-all}"

need() { command -v "$1" >/dev/null || { echo "missing $1 ($2)"; exit 1; }; }

tools() {
  need node "brew install node"
  if [ ! -d "$ASSET_TOOLS/node_modules/@gltf-transform/functions" ] || [ ! -d "$ASSET_TOOLS/node_modules/sharp" ]; then
    mkdir -p "$ASSET_TOOLS"
    [ -f "$ASSET_TOOLS/package.json" ] || echo '{ "private": true, "type": "module" }' > "$ASSET_TOOLS/package.json"
    npm install --prefix "$ASSET_TOOLS" --no-audit --no-fund \
      @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer draco3dgltf sharp
  fi
  cp scripts/asset-tools.mjs "$ASSET_TOOLS/asset-tools.mjs"
}

textures() {
  need cwebp "brew install webp"
  mkdir -p "$OUT/board"
  for f in "$ART"/board/*.png; do
    b=$(basename "$f" .png)
    [ "$b" = board ] && continue
    cwebp -quiet -q 80 -m 6 -resize 512 0 "$f" -o "$OUT/board/$b.webp"   # width 512, height keeps the aspect
  done
  cwebp -quiet -q 82 -m 6 "$ART/board/board.png" -o "$OUT/board/board.webp"  # centre art: keep 2048, it fills most of the view
  echo "textures: $(ls "$OUT"/board/*.webp | wc -l | tr -d ' ') files, $(du -ch "$OUT"/board/*.webp | tail -1 | cut -f1)"
}

logo() {
  need cwebp "brew install webp"
  cwebp -quiet -q 85 -m 6 -resize 336 0 "$ART/polymono-logo.png" -o public/polymono-logo.webp
  tools
  node "$ASSET_TOOLS/asset-tools.mjs" icon "$PWD/$ART/polymono-logo.png" "$PWD/public/icon-192.png" 192
  echo "logo: $(du -h public/polymono-logo.webp | cut -f1), icon: $(du -h public/icon-192.png | cut -f1)"
}

tokens() {
  tools
  mkdir -p "$OUT/tokens"
  for m in $TOKENS; do
    node "$ASSET_TOOLS/asset-tools.mjs" lowpoly "$PWD/$ART/tokens/$m.glb" "$PWD/$OUT/tokens/$m.glb" "$TOKEN_TRIANGLES"
  done
  # Fallback if the lowpoly path ever breaks (larger: 1.66 MB for all six, 18-133k triangles each):
  #   npx -y @gltf-transform/cli@4 optimize $ART/tokens/$m.glb $OUT/tokens/$m.glb --compress draco \
  #     --prune-attributes true --simplify-ratio 0.02 --simplify-error 0.005 --texture-compress false
  echo "tokens: $(du -ch "$OUT"/tokens/*.glb | tail -1 | cut -f1)"
}

draco_decoder() {
  # drei's useGLTF defaults to the gstatic CDN; the board points it at /draco/ instead (see board/assets.js).
  # Only the wasm build is copied: every browser that runs WebGL2 has WebAssembly.
  mkdir -p public/draco
  cp node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js \
     node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm public/draco/
  echo "draco: $(du -ch public/draco/* | tail -1 | cut -f1)"
}

case "$STEP" in
  all) textures; logo; tokens; draco_decoder ;;
  textures) textures ;;
  logo) logo ;;
  tokens) tokens ;;
  draco) draco_decoder ;;
  *) echo "usage: $0 [all|textures|logo|tokens|draco]"; exit 1 ;;
esac
