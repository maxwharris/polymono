/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy target: BACKEND_URL=http://localhost:3002 npm run dev (3002 is the backend's default port).
const backend = process.env.BACKEND_URL || 'http://localhost:3002'

// three.js, react-three-fiber, drei and their helpers go into one `three` chunk that only the (lazy)
// Board needs, so Login and the Lobby never download it. Anything shared with the app (react, zustand,
// scheduler) stays out of it.
const THREE_DEPS = /[\\/]node_modules[\\/](?:three|three-stdlib|three-mesh-bvh|@react-three|@monogrid|@mediapipe|@use-gesture|@tweenjs|troika-[^\\/]+|camera-controls|maath|meshline|meshoptimizer|draco3d|stats-gl|stats\.js|detect-gpu|hls\.js|its-fine|suspend-react|tunnel-rat|react-reconciler|react-use-measure|bidi-js|webgl-sdf-generator|webgl-constants|glsl-noise|potpack|promise-worker-transferable)[\\/]/

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    allowedHosts: ['mp.maxharris.io'],
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backend,
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Every other dependency, and Rollup's virtual helpers (\0commonjsHelpers, \0vite/preload-helper),
        // go to `vendor` explicitly; otherwise Rollup may place them in the three chunk and the entry would
        // have to preload all of three.js.
        manualChunks(id) {
          if (THREE_DEPS.test(id)) return 'three'
          if (id.includes('node_modules') || id.startsWith('\0')) return 'vendor'
        }
      }
    },
    chunkSizeWarningLimit: 1500 // the three chunk is ~1.3 MB (370 kB gzip) and loads only with the board
  }
})
