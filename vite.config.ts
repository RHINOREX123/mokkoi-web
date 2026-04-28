import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
})
