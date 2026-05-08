/**
 * BYO-Backend Track B: exporter wiring for auth screens.
 *
 * Verifies that when `dataAction` is supplied for an auth screen:
 *   - useState hooks for email/password are emitted
 *   - the matching TouchableOpacity gets a supabase.auth.* onPress
 *   - the supabase import + Alert import are added
 *   - the email/password TextInputs get value={...} + onChangeText={...}
 *
 * Also verifies back-compat: a non-auth screen (no dataAction) yields the
 * exact same exporter output it did before Track B — zero new imports, zero
 * supabase references, zero useState.
 */

import { describe, it, expect } from 'vitest'
import { convertTreeToTSX, AUTH_BUTTON_TEXT_REGEX } from '../exportTsx'
import type { ComponentNode } from '../../types/mokkoi'

function authLoginTree(): ComponentNode {
  return {
    type: 'View',
    children: [
      { type: 'Text', children: ['Welcome back'] },
      {
        type: 'TextInput',
        props: { id: 'email', placeholder: 'Email' },
      },
      {
        type: 'TextInput',
        props: { id: 'password', placeholder: 'Password', secureTextEntry: true },
      },
      {
        type: 'TouchableOpacity',
        children: [{ type: 'Text', children: ['Sign In'] }],
      },
    ],
  }
}

function authSignupTree(): ComponentNode {
  return {
    type: 'View',
    children: [
      { type: 'Text', children: ['Create account'] },
      {
        type: 'TextInput',
        props: { id: 'email', placeholder: 'Email' },
      },
      {
        type: 'TextInput',
        props: { id: 'password', placeholder: 'Password', secureTextEntry: true },
      },
      {
        type: 'TouchableOpacity',
        children: [{ type: 'Text', children: ['Sign Up'] }],
      },
    ],
  }
}

describe('AUTH_BUTTON_TEXT_REGEX convention', () => {
  it('matches the four documented variants (case-insensitive)', () => {
    expect('Sign In').toMatch(AUTH_BUTTON_TEXT_REGEX)
    expect('LOG IN').toMatch(AUTH_BUTTON_TEXT_REGEX)
    expect('sign up').toMatch(AUTH_BUTTON_TEXT_REGEX)
    expect('Create Account').toMatch(AUTH_BUTTON_TEXT_REGEX)
  })

  it('does not match unrelated button labels', () => {
    expect('Continue').not.toMatch(AUTH_BUTTON_TEXT_REGEX)
    expect('Submit').not.toMatch(AUTH_BUTTON_TEXT_REGEX)
    expect('Back').not.toMatch(AUTH_BUTTON_TEXT_REGEX)
  })
})

describe('convertTreeToTSX — auth.signInWithPassword', () => {
  it('emits supabase.auth.signInWithPassword + useState + import', () => {
    const tsx = convertTreeToTSX(authLoginTree(), 'Login', {
      dataAction: { kind: 'auth.signInWithPassword', redirectScreenName: 'Home' },
    })

    expect(tsx).toContain("import { supabase } from './lib/supabase';")
    expect(tsx).toContain("import React, { useState } from 'react';")
    expect(tsx).toContain("const [email, setEmail] = useState('');")
    expect(tsx).toContain("const [password, setPassword] = useState('');")
    expect(tsx).toContain('supabase.auth.signInWithPassword({ email, password })')
    expect(tsx).toContain("navigation.navigate('Home')")
    expect(tsx).toContain("Alert.alert('Sign in failed'")
    // Alert must be imported from react-native
    expect(tsx).toMatch(/import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/)
  })

  it('wires onChangeText/value on the email + password TextInputs', () => {
    const tsx = convertTreeToTSX(authLoginTree(), 'Login', {
      dataAction: { kind: 'auth.signInWithPassword', redirectScreenName: 'Home' },
    })

    expect(tsx).toContain('value={email}')
    expect(tsx).toContain('onChangeText={setEmail}')
    expect(tsx).toContain('value={password}')
    expect(tsx).toContain('onChangeText={setPassword}')
  })

  it('only wires the FIRST matching button (convention: first match wins)', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'TextInput', props: { id: 'email', placeholder: 'Email' } },
        { type: 'TextInput', props: { id: 'password', placeholder: 'Password', secureTextEntry: true } },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Sign In'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Sign In with SSO'] }] },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Login', {
      dataAction: { kind: 'auth.signInWithPassword', redirectScreenName: 'Home' },
    })
    // Exactly one supabase call should be emitted.
    const matches = tsx.match(/supabase\.auth\.signInWithPassword/g) || []
    expect(matches).toHaveLength(1)
  })
})

describe('convertTreeToTSX — auth.signUp', () => {
  it('emits supabase.auth.signUp for signup screens', () => {
    const tsx = convertTreeToTSX(authSignupTree(), 'Signup', {
      dataAction: { kind: 'auth.signUp', redirectScreenName: 'Home' },
    })

    expect(tsx).toContain('supabase.auth.signUp({ email, password })')
    expect(tsx).not.toContain('signInWithPassword')
    expect(tsx).toContain("import { supabase } from './lib/supabase';")
    expect(tsx).toContain("const [email, setEmail] = useState('');")
    expect(tsx).toContain("navigation.navigate('Home')")
  })
})

describe('convertTreeToTSX — back-compat (no dataAction)', () => {
  it('emits no Supabase code, no extra useState, no Alert when dataAction is absent', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'Text', children: ['Hello'] },
        {
          type: 'TouchableOpacity',
          children: [{ type: 'Text', children: ['Continue'] }],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Home')

    expect(tsx).not.toContain('supabase')
    expect(tsx).not.toContain('useState')
    expect(tsx).not.toContain('Alert.alert')
    expect(tsx).not.toMatch(/\bAlert\b/)
    // Plain React import (no destructure of useState)
    expect(tsx).toContain("import React from 'react';")
  })

  it('does not wire Supabase when dataAction is given but no matching button exists', () => {
    // Auth screen claim, but the only button is "Continue" — convention regex
    // does not match. Exporter must NOT emit supabase code in this case.
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'TextInput', props: { id: 'email', placeholder: 'Email' } },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Continue'] }] },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Login', {
      dataAction: { kind: 'auth.signInWithPassword', redirectScreenName: 'Home' },
    })

    expect(tsx).not.toContain('supabase.auth.signInWithPassword')
    expect(tsx).not.toContain("import { supabase }")
  })
})
