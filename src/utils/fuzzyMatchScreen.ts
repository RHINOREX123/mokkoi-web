/** Fuzzy fallback: match a tab/link label against a screen name when no
 *  FlowConnection exists. Strips a trailing "Screen" word + normalizes
 *  whitespace/case. Tries exact match first, then substring match in either
 *  direction (covers "Profile" tab → "ProfileScreen", and "Home" tab → "Home").
 *
 *  Generic over screen shape so both RuntimePoc (RuntimeScreenSummary) and
 *  RuntimeIframePreview (GeneratedScreen) can share the implementation. */
export function fuzzyMatchScreen<T extends { name: string }>(
  label: string,
  screens: T[],
): T | null {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*screen$/, '').trim()
  const target = norm(label)
  if (!target) return null
  for (const s of screens) if (norm(s.name) === target) return s
  for (const s of screens) {
    const n = norm(s.name)
    if (n && (n.includes(target) || target.includes(n))) return s
  }
  return null
}
