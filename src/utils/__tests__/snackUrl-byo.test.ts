/**
 * BYO-Backend: buildSnackPayload Supabase emission
 *
 * Verifies that the @supabase/supabase-js dep + generated lib/supabase.ts
 * are emitted only when byoSupabase creds are present and well-formed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'

const tree: ComponentNode = {
  type: 'View',
  children: [{ type: 'Text', children: ['Hello'] }],
}

const screens = [{ id: 's1', name: 'Home', tree }]

describe('buildSnackPayload — BYO Supabase', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('omits Supabase dep + lib/supabase.ts when byoSupabase is null', () => {
    const payload = buildSnackPayload({ projectName: 'P', screens, byoSupabase: null })
    expect(payload.dependencies['@supabase/supabase-js']).toBeUndefined()
    expect(payload.files['lib/supabase.ts']).toBeUndefined()
  })

  it('omits Supabase wiring when byoSupabase is undefined (default)', () => {
    const payload = buildSnackPayload({ projectName: 'P', screens })
    expect(payload.dependencies['@supabase/supabase-js']).toBeUndefined()
    expect(payload.files['lib/supabase.ts']).toBeUndefined()
  })

  it('emits dep + client file with credentials inlined when creds set', () => {
    const url = 'https://abc123.supabase.co'
    const anonKey = 'eyJhbGciOi.PAYLOAD.SIG'
    const payload = buildSnackPayload({
      projectName: 'P',
      screens,
      byoSupabase: { url, anonKey },
    })

    expect(payload.dependencies['@supabase/supabase-js']).toBeDefined()
    expect(payload.dependencies['@supabase/supabase-js'].version).toMatch(/^\^?2\./)

    const file = payload.files['lib/supabase.ts']
    expect(file).toBeDefined()
    expect(file.type).toBe('CODE')
    expect(file.contents).toContain("import { createClient } from '@supabase/supabase-js'")
    expect(file.contents).toContain('export const supabase = createClient(')
    expect(file.contents).toContain(JSON.stringify(url))
    expect(file.contents).toContain(JSON.stringify(anonKey))
  })

  it('escapes embedded quotes and backslashes safely', () => {
    const url = 'https://x.supabase.co'
    const anonKey = 'has"quote\\and\nnewline'
    const payload = buildSnackPayload({
      projectName: 'P',
      screens,
      byoSupabase: { url, anonKey },
    })
    const file = payload.files['lib/supabase.ts']
    expect(file).toBeDefined()
    // JSON.stringify escapes — raw " or \ should not appear unescaped in source
    expect(file.contents).toContain(JSON.stringify(anonKey))
    expect(file.contents).not.toContain('has"quote\\and\nnewline')
  })

  it('skips emission and warns when url is empty string', () => {
    const payload = buildSnackPayload({
      projectName: 'P',
      screens,
      byoSupabase: { url: '', anonKey: 'eyJhbGciOi.x.y' },
    })
    expect(payload.dependencies['@supabase/supabase-js']).toBeUndefined()
    expect(payload.files['lib/supabase.ts']).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('skips emission and warns when anonKey is empty string', () => {
    const payload = buildSnackPayload({
      projectName: 'P',
      screens,
      byoSupabase: { url: 'https://x.supabase.co', anonKey: '' },
    })
    expect(payload.dependencies['@supabase/supabase-js']).toBeUndefined()
    expect(payload.files['lib/supabase.ts']).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('skips emission when both fields are whitespace-only', () => {
    const payload = buildSnackPayload({
      projectName: 'P',
      screens,
      byoSupabase: { url: '   ', anonKey: '\t\n' },
    })
    expect(payload.dependencies['@supabase/supabase-js']).toBeUndefined()
    expect(payload.files['lib/supabase.ts']).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })
})
