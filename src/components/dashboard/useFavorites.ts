import { useCallback, useEffect, useState } from 'react'

const KEY = 'mokkoi.favorites'
/** Same-tab change notification. The browser's `storage` event ONLY fires
 *  on OTHER tabs, never the tab that wrote to localStorage. We have multiple
 *  useFavorites callers in the same tab (dashboard recents strip, sidebar
 *  Favourites tab, sidebar 3-dot menu) — they need to stay in sync when any
 *  one of them toggles a favorite. A CustomEvent dispatched after every
 *  write fans the change out to all listening instances in this tab.
 *  Cross-tab sync still works via the standard 'storage' event. */
const SYNC_EVENT = 'mokkoi:favorites-changed'

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function write(set: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
    // Notify other useFavorites instances mounted in this same tab.
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
  } catch {
    // localStorage can throw on quota exceeded / private mode — favorites are
    // a nice-to-have, not load-bearing, so swallowing is correct.
  }
}

/**
 * useFavorites — localStorage-backed set of favorited project IDs.
 *
 * v1 stores in localStorage so we don't need a DB migration to ship the
 * dashboard redesign. When the feature proves itself, we can promote to a
 * real `is_favorite` column on `projects` (Supabase migration + RLS) without
 * any UI churn — this hook's signature stays the same.
 *
 * Sync model:
 *   - Cross-tab:  standard `storage` event (fires only on other tabs)
 *   - Same-tab:   custom `mokkoi:favorites-changed` event dispatched on
 *                 every write so all useFavorites instances in this tab
 *                 re-read and re-render. Without this, sidebar tabs and
 *                 dashboard cards would drift until the next refresh.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => read())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavorites(read())
    }
    const onLocalChange = () => setFavorites(read())
    window.addEventListener('storage', onStorage)
    window.addEventListener(SYNC_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SYNC_EVENT, onLocalChange)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(next)
      return next
    })
  }, [])

  const has = useCallback((id: string) => favorites.has(id), [favorites])

  return { favorites, has, toggle }
}
