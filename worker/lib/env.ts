// Load .env.local / .env into process.env for local runs (CI and Vercel set real env vars).
// Values are never printed.
import { existsSync, readFileSync } from 'node:fs'

export function loadEnv(files = ['.env.local', '.env']) {
  for (const file of files) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || m[1] in process.env) continue
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}
