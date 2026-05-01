import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      // Polyfill Node's `assert` for snack-sdk's TransportImplWebPlayer.
      // The SDK uses `assert(...)` for runtime invariants — without this
      // alias Vite resolves it to an empty module and the SDK throws
      // "(0, a.default) is not a function" when constructing the Snack.
      assert: 'assert',
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      input: {
        // Main canvas SPA — served at /index.html.
        main: resolve(__dirname, 'index.html'),
        // Runtime iframe entry — served at /runtime/index.html. Declared as
        // a separate Rollup entry so vite build emits dist/runtime/index.html
        // with hashed/bundled JS instead of leaving it as an unprocessed
        // public/ asset that points at dev-only source paths (the bug Week 4
        // Day 1.5 fixed). Both iframe consumers reference /runtime/index.html
        // (src/components/RuntimeIframePreview.tsx, src/pages/RuntimePoc.tsx).
        runtime: resolve(__dirname, 'runtime/index.html'),
      },
    },
  },
})
