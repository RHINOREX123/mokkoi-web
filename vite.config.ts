import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

/**
 * Dev only: serve api/xray.ts from the Vite dev server (Vercel serves it in production).
 * Uses the same handler with a minimal VercelRequest/VercelResponse shim.
 */
function xrayApiDev(): Plugin {
  return {
    name: 'xray-api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env })
      server.middlewares.use('/api/xray', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        let raw = ''
        for await (const chunk of req) raw += chunk
        const mod = await server.ssrLoadModule('/api/xray.ts')
        let code = 200
        const vreq = Object.assign(req, { query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : undefined })
        const vres = Object.assign(res, {
          status(c: number) { code = c; return vres },
          json(data: unknown) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return vres },
        })
        await mod.default(vreq, vres)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), xrayApiDev()],
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
