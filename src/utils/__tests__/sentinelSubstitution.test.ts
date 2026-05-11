import { describe, it, expect } from 'vitest'
import { lookupPath, substituteSentinels } from '../sentinelSubstitution'
import type { ComponentNode } from '../../types/mokkoi'

describe('lookupPath', () => {
  it('resolves a flat key', () => {
    expect(lookupPath({ name: 'Push-ups' }, 'name')).toBe('Push-ups')
  })

  it('resolves a dotted path through arrays', () => {
    const rec = { ingredients: ['flour', 'sugar', 'egg'] }
    expect(lookupPath(rec, 'ingredients.0')).toBe('flour')
    expect(lookupPath(rec, 'ingredients.2')).toBe('egg')
  })

  it('returns undefined on miss', () => {
    expect(lookupPath({ a: 1 }, 'b')).toBeUndefined()
    expect(lookupPath({ a: { b: 1 } }, 'a.c')).toBeUndefined()
  })

  it('returns undefined when record itself is missing', () => {
    expect(lookupPath(undefined, 'name')).toBeUndefined()
  })
})

describe('substituteSentinels', () => {
  const record = { name: 'Push-ups', duration: 30, ingredients: ['arms', 'core'] }

  it('replaces {{key}} in Text node strings', () => {
    const tree: ComponentNode = {
      type: 'Text',
      children: ['{{name}}'],
    }
    const out = substituteSentinels(tree, record) as ComponentNode
    expect(out.children).toEqual(['Push-ups'])
  })

  it('resolves dotted paths', () => {
    const tree: ComponentNode = {
      type: 'Text',
      children: ['First: {{ingredients.0}}'],
    }
    const out = substituteSentinels(tree, record) as ComponentNode
    expect(out.children).toEqual(['First: arms'])
  })

  it('leaves unresolved sentinels in place as a debug aid', () => {
    const tree: ComponentNode = {
      type: 'Text',
      children: ['Hello {{unknownField}}'],
    }
    const out = substituteSentinels(tree, record) as ComponentNode
    expect(out.children).toEqual(['Hello {{unknownField}}'])
  })

  it('only substitutes inside Text node strings, not arbitrary strings', () => {
    // A View with a stray string child shouldn't be substituted (only Text).
    const tree: ComponentNode = {
      type: 'View',
      children: ['{{name}}'],
    }
    const out = substituteSentinels(tree, record) as ComponentNode
    expect(out.children).toEqual(['{{name}}'])
  })

  it('recurses through nested non-Text nodes', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'Text', children: ['Name: {{name}}'] },
        {
          type: 'View',
          children: [{ type: 'Text', children: ['Duration: {{duration}} min'] }],
        },
      ],
    }
    const out = substituteSentinels(tree, record) as ComponentNode
    const first = out.children![0] as ComponentNode
    const nestedText = ((out.children![1] as ComponentNode).children![0]) as ComponentNode
    expect(first.children).toEqual(['Name: Push-ups'])
    expect(nestedText.children).toEqual(['Duration: 30 min'])
  })

  it('does not mutate input', () => {
    const tree: ComponentNode = { type: 'Text', children: ['{{name}}'] }
    const before = JSON.stringify(tree)
    substituteSentinels(tree, record)
    expect(JSON.stringify(tree)).toBe(before)
  })

  it('passes through strings and null/invalid nodes', () => {
    expect(substituteSentinels('plain', record)).toBe('plain')
  })

  it('is a no-op when record is undefined', () => {
    const tree: ComponentNode = { type: 'Text', children: ['{{name}}'] }
    const out = substituteSentinels(tree, undefined) as ComponentNode
    expect(out.children).toEqual(['{{name}}'])
  })
})
