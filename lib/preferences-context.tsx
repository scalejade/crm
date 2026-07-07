'use client'

// Device-local UI preferences, persisted to localStorage only (never the DB).
import { createContext, useContext, useEffect, useState } from 'react'

interface PreferencesContextValue {
  showClock: boolean
  setShowClock: (value: boolean) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [showClock, setShowClockState] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('crm-show-clock')
    if (stored !== null) setShowClockState(stored === 'true')
  }, [])

  const setShowClock = (value: boolean) => {
    setShowClockState(value)
    localStorage.setItem('crm-show-clock', String(value))
  }

  return (
    <PreferencesContext.Provider value={{ showClock, setShowClock }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
