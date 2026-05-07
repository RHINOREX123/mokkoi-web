#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'api']
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html'])
const FINGERPRINT = /Ã[¢‚Æ‚]|Â[§¦]/

async function* walk(dir) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (EXTS.has(extname(e.name))) yield p
  }
}

const hits = []
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const text = await readFile(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (FINGERPRINT.test(lines[i])) hits.push(`${file}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
    }
  }
}

if (hits.length) {
  console.error(`Mojibake detected in ${hits.length} line(s):`)
  for (const h of hits) console.error('  ' + h)
  console.error('\nSee docs/roadmap/fix-utf8-mojibake.md. Save files as UTF-8 (not Windows-1252).')
  process.exit(1)
}
console.log('OK: no UTF-8 mojibake fingerprints found.')
