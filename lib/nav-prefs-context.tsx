'use client'

// Per-user sidebar tab visibility, persisted to the database (crm.nav_prefs).
// A missing key means visible, so every tab defaults to shown.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type TabVisibility = Record<string, boolean>

interface NavPrefsContextValue {
  loaded: boolean
  isTabVisible: (key: string) => boolean
  setTabVisible: (key: string, visible: boolean) => Promise<void>
}

const NavPrefsContext = createContext<NavPrefsContextValue | null>(null)

export function NavPrefsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [tabs, setTabs] = useState<TabVisibility>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) { setTabs({}); setLoaded(false); return }
    let cancelled = false
    supabase.schema('crm')
      .from('nav_prefs')
      .select('tabs')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setTabs((data?.tabs as TabVisibility) ?? {})
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [user])

  const isTabVisible = useCallback(
    (key: string) => tabs[key] !== false,
    [tabs]
  )

  const setTabVisible = useCallback(async (key: string, visible: boolean) => {
    if (!user) return
    const next = { ...tabs, [key]: visible }
    setTabs(next) // optimistic
    const { error } = await supabase.schema('crm').from('nav_prefs').upsert({
      user_id: user.id,
      tabs: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setTabs(tabs) // roll back
      throw error
    }
  }, [user, tabs])

  return (
    <NavPrefsContext.Provider value={{ loaded, isTabVisible, setTabVisible }}>
      {children}
    </NavPrefsContext.Provider>
  )
}

export function useNavPrefs(): NavPrefsContextValue {
  const ctx = useContext(NavPrefsContext)
  if (!ctx) throw new Error('useNavPrefs must be used within NavPrefsProvider')
  return ctx
}
