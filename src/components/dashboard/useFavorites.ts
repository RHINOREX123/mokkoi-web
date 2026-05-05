import { useCallback, useEffect, useState } from 'react'

const KEY = 'mokkoi.favorites'

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
 * Cross-tab sync via the 'storage' event keeps both windows in sync if the
 * user has Mokkoi open in two tabs.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => read())

  // Cross-tab sync: another tab toggled a favorite, mirror it here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavorites(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
