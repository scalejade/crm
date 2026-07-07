'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export const DEFAULT_COMPANY_NAME = 'CRM'

interface BrandingContextValue {
  companyName: string
  logoUrl: string | null
  loading: boolean
  refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.schema('crm')
      .from('branding')
      .select('company_name, logo_url')
      .maybeSingle()
    if (data) {
      setCompanyName(data.company_name || DEFAULT_COMPANY_NAME)
      setLogoUrl(data.logo_url || null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <BrandingContext.Provider value={{ companyName, logoUrl, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
