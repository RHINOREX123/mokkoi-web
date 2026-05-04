/**
 * Persona unifier for multi-screen app generation.
 *
 * Each screen in an app was being generated without shared context about
 * "who is using this app" — so the LLM picked different names for avatars,
 * greetings, and profile pages across screens of the SAME app. Users saw
 * a Profile showing "Sarah Chen" while Home showed a "DT"-initials avatar
 * (e.g. "Dana Thompson") — obviously broken.
 *
 * Fix: generate ONE persona per app (deterministic from app name seed)
 * and walk every screen's tree AFTER generation, normalizing any person-
 * name or email-looking string to the shared persona. This avoids having
 * to change all the per-screen LLM prompts and post-processes what the
 * LLM already produced.
 */

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Morgan', 'Taylor', 'Riley', 'Sam', 'Casey', 'Avery',
  'Drew', 'Cameron', 'Quinn', 'Rowan', 'Sage', 'Skylar', 'Emery', 'Reese',
  'Maya', 'Leo', 'Ivy', 'Finn', 'Nora', 'Ezra', 'Chloe', 'Kai',
]
const LAST_NAMES = [
  'Rivera', 'Patel', 'Chen', 'Kim', 'Singh', 'Nguyen', 'Garcia', 'Okafor',
  'Silva', 'Cohen', 'Tanaka', 'Hassan', 'Ward', 'Reyes', 'Park', 'Walsh',
  'Bennett', 'Khan', 'Murphy', 'Sato',
]

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h >>> 0
}

export interface Persona {
  fullName: string
  firstName: string
  lastName: string
  email: string
  handle: string
}

/** Derive a deterministic persona from an app-name seed. Same seed = same
 *  persona, so regenerating the same app twice produces the same user. */
export function buildPersona(seed: string): Persona {
  const base = (seed || 'mokkoi-app').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mokkoiapp'
  const h1 = fnv1a(base)
  const h2 = fnv1a(base + ':last')
  const firstName = FIRST_NAMES[h1 % FIRST_NAMES.length]
  const lastName = LAST_NAMES[h2 % LAST_NAMES.length]
  const fullName = `${firstName} ${lastName}`
  const handleBase = `${firstName}${lastName}`.toLowerCase()
  const domain = base.length > 4 ? base : 'example'
  return {
    fullName,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}.app`,
    handle: `@${handleBase}`,
  }
}

// Patterns we treat as "this is a person's name the LLM invented"
const PERSON_NAME_RE = /^[A-Z][a-z]{1,20}(?:\s[A-Z][a-z]{1,20}){0,2}$/
const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i
// Greeting text that contains an inline first name, e.g.
//   "Hi, Marcus!"  "Hello Sarah"  "Welcome back, Jordan 👋"  "Hey John!"
// We rewrite just the name portion so the rest of the phrase is preserved.
// Captures: [1]=greeting word, [2]=comma+space or space, [3]=name, [4]=trailing
const GREETING_NAME_RE = /^(Hi|Hey|Hello|Welcome(?: back)?|Good\s(?:morning|afternoon|evening))(,?\s+)([A-Z][a-z]{1,20})(\b[\s\S]*)$/
// Components whose `name`/`user` prop is definitely a person identity (not a
// product title, restaurant name, etc.). Keep this tight to avoid rewriting
// e.g. an AppName text node.
const IDENTITY_TYPES = new Set([
  'AvatarCircle', 'UserAvatar', 'ProfileHeader', 'ProfileStats',
])

interface TreeLike {
  type?: string
  props?: Record<string, unknown>
  children?: Array<TreeLike | string> | undefined
  [k: string]: unknown
}

/**
 * Mutates the tree in place. Replaces:
 *   - Any IDENTITY_TYPES component's `name`/`user`/`avatar` prop with persona.fullName
 *   - Any Text child that is a bare person-name string (e.g. "Sarah Chen") with persona.fullName
 *   - Any Text child matching an email regex with persona.email
 *
 * Bounded recursion + type-guarded property access so this never throws on
 * the varied trees the LLM produces.
 */
export function applyPersonaToTree(
  node: unknown,
  persona: Persona,
  depth = 0,
  insideIdentitySubtree = false,
): void {
  if (depth > 100 || !node || typeof node !== 'object') return
  const n = node as TreeLike

  // Normalize identity-component props
  if (n.type && IDENTITY_TYPES.has(n.type) && n.props && typeof n.props === 'object') {
    const props = n.props as Record<string, unknown>
    for (const key of ['name', 'user', 'avatar', 'userName']) {
      if (typeof props[key] === 'string' && PERSON_NAME_RE.test(props[key] as string)) {
        props[key] = persona.fullName
      }
    }
    if (typeof props.email === 'string' && EMAIL_RE.test(props.email as string)) {
      props.email = persona.email
    }
  }

  // Text-child rewrites must only fire inside an identity-component subtree.
  // Otherwise PERSON_NAME_RE matches generic two-Capitalized-word UI strings
  // ("Bench Press", "Recent Activity", "Quick Actions", "Browse Exercises")
  // and clobbers them all to the persona name.
  if (insideIdentitySubtree && n.type === 'Text' && Array.isArray(n.children)) {
    n.children = n.children.map(c => {
      if (typeof c !== 'string') return c
      const trimmed = c.trim()
      // Full "First Last" name alone in the Text node
      if (PERSON_NAME_RE.test(trimmed) && trimmed.split(' ').length >= 2) return persona.fullName
      // Email alone
      if (EMAIL_RE.test(trimmed)) return persona.email
      // Inline greeting — "Hi, Marcus!" → "Hi, <persona.firstName>!"
      // Preserves the original greeting word, punctuation, and any trailing emoji
      // so we don't flatten "Hi, Marcus! 👋" into just the name.
      const g = trimmed.match(GREETING_NAME_RE)
      if (g) {
        return `${g[1]}${g[2]}${persona.firstName}${g[4]}`
      }
      return c
    })
  }

  // Recurse — flip the flag when entering an identity-type subtree
  const childInside = insideIdentitySubtree || (typeof n.type === 'string' && IDENTITY_TYPES.has(n.type))
  if (Array.isArray(n.children)) {
    for (const c of n.children) {
      if (typeof c !== 'string') applyPersonaToTree(c, persona, depth + 1, childInside)
    }
  }
}
