import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore existing session or sign in anonymously
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error) setUser(data.user)
      }
      setLoading(false)
    })

    // Keep user state in sync with auth changes (token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
