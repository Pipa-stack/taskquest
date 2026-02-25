import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Returns the current Supabase auth state.
 * - user: the authenticated user object, or null
 * - loading: true while the initial session is being resolved
 *
 * When supabase is not configured (no env vars), always returns
 * { user: null, loading: false } — offline-only mode.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!supabase)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
