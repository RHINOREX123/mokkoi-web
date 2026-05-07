/**
 * BYO-Backend auth-export tests (Track B).
 *
 * Verifies the exporter wires Supabase auth calls into screens whose planner
 * emitted a screen-level dataAction. Covers:
 *   1. dataAction.kind='auth.signInWithPassword' → supabase.auth.signInWithPassword in onPress
 *   2. dataAction.kind='auth.signUp' → supabase.auth.signUp in onPress
 *   3. No dataAction → exporter output unchanged (back-compat)
 *   4. Email/password TextInputs become controlled (value + onChangeText)
 *   5. useState hooks + supabase import emitted exactly when auth is wired
 *   6. Convention regex /sign in|log in|sign up|create account/i picks the action button
 *   7. Successful call navigates to redirectScreenName when provided
 */

import { describe, it, expect } from 'vitest'
import { convertTreeToTSX } from '../exportTsx'
import type { ComponentNode } from '../../types/mokkoi'

function authScreen(buttonText: string): ComponentNode {
  return {
    type: 'View',
    style: { flex: 1 },
    children: [
      { type: 'Text', children: ['Welcome'] },
      {
        type: 'TextInput',
        props: { placeholder: 'Email', placeholderTextColor: '#888' },
      },
      {
        type: 'TextInput',
        props: { placeholder: 'Password', secureTextEntry: true },
      },
      {
        type: 'TouchableOpacity',
        children: [{ type: 'Text', children: [buttonText] }],
      },
    ],
  }
}

describe('convertTreeToTSX — BYO-Backend auth wiring', () => {
  it('emits supabase.auth.signInWithPassword on the matched action button', () => {
    const tsx = convertTreeToTSX(authScreen('Sign In'), 'Login', {
      dataAction: { kind: 'auth.signInWithPassword', redirectScreenName: 'HomeScreen' },
    })

    expect(tsx).toContain("import { supabase } from './lib/supabase';")
    expect(tsx).toContain("import React, { useState } from 'react';")
    expect(tsx).toContain('supabase.auth.signInWithPassword({ email, password })')
    expect(tsx).toContain("Alert.alert('Sign in failed'")
    expect(tsx).toContain("navigation.navigate('HomeScreen')")
    // useState hooks for both fields
    expect(tsx).toContain("const [email, setEmail] = useState('');")
    expect(tsx).toContain("const [password, setPassword] = useState('');")
    // Inputs are controlled
    expect(tsx).toContain('value={email}')
    expect(tsx).toContain('onChangeText={setEmail}')
    expect(tsx).toContain('value={password}')
    expect(tsx).toContain('onChangeText={setPassword}')
  })

  it('emits supabase.auth.signUp for signup screens', () => {
    const tsx = convertTreeToTSX(authScreen('Create Account'), 'Signup', {
      dataAction: { kind: 'auth.signUp', redirectScreenName: 'HomeScreen' },
    })

    expect(tsx).toContain('supabase.auth.signUp({ email, password })')
    expect(tsx).toContain("Alert.alert('Sign up failed'")
    expect(tsx).not.toContain('signInWithPassword')
  })

  it('matches "Log In" via the convention regex', () => {
    const tsx = convertTreeToTSX(authScreen('Log In'), 'Login', {
      dataAction: { kind: 'auth.signInWithPassword' },
    })
    expect(tsx).toContain('supabase.auth.signInWithPassword')
  })

  it('matches "Sign Up" via the convention regex', () => {
    const tsx = convertTreeToTSX(authScreen('Sign Up'), 'Signup', {
      dataAction: { kind: 'auth.signUp' },
    })
    expect(tsx).toContain('supabase.auth.signUp')
  })

  it('emits NO supabase code when dataAction is omitted (back-compat)', () => {
    const tsx = convertTreeToTSX(authScreen('Sign In'), 'Login')

    expect(tsx).not.toContain('supabase')
    expect(tsx).not.toContain('useState')
    expect(tsx).not.toContain('Alert.alert')
    // The button is just a static TouchableOpacity, no onPress
    expect(tsx).not.toContain('signInWithPassword')
  })

  it('emits NO supabase code on regular (non-auth) screens', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'Text', children: ['Dashboard'] },
        {
          type: 'TouchableOpacity',
          children: [{ type: 'Text', children: ['View profile'] }],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Dashboard')

    expect(tsx).not.toContain('supabase')
    expect(tsx).not.toContain('useState')
  })

  it('omits the navigate call when redirectScreenName is undefined', () => {
    const tsx = convertTreeToTSX(authScreen('Sign In'), 'Login', {
      dataAction: { kind: 'auth.signInWithPassword' },
    })

    expect(tsx).toContain('supabase.auth.signInWithPassword')
    expect(tsx).not.toContain('navigation.navigate')
    // useNavigation should NOT be imported when no redirect is wired
    expect(tsx).not.toContain('@react-navigation/native')
  })

  it('only the FIRST matching button gets the auth handler (convention)', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'TextInput', props: { placeholder: 'Email' } },
        { type: 'TextInput', props: { placeholder: 'Password', secureTextEntry: true } },
        // Two candidates; only the first should be wired.
        {
          type: 'TouchableOpacity',
          children: [{ type: 'Text', children: ['Sign In'] }],
        },
        {
          type: 'TouchableOpacity',
          children: [{ type: 'Text', children: ['Sign In with Google'] }],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Login', {
      dataAction: { kind: 'auth.signInWithPassword' },
    })

    const matches = tsx.match(/supabase\.auth\.signInWithPassword/g) || []
    expect(matches).toHaveLength(1)
  })

  it('respects an explicit props.action marker over the text-regex', () => {
    // Button text doesn't match the regex, but props.action explicitly tags it.
    const tree: ComponentNode = {
      type: 'View',
      children: [
        { type: 'TextInput', props: { placeholder: 'Email' } },
        { type: 'TextInput', props: { placeholder: 'Password', secureTextEntry: true } },
        {
          type: 'TouchableOpacity',
          props: { action: 'auth.signInWithPassword' },
          children: [{ type: 'Text', children: ['Continue'] }],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Login', {
      dataAction: { kind: 'auth.signInWithPassword' },
    })
    expect(tsx).toContain('supabase.auth.signInWithPassword')
  })
})
