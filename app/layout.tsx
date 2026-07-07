import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/providers/toast-provider'
import { ThemeProvider } from '@/lib/theme-context'
import { BrandingProvider } from '@/lib/branding-context'
import { PreferencesProvider } from '@/lib/preferences-context'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'CRM',
  description: 'Customer Relationship Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} data-theme="dark" suppressHydrationWarning>
      <head />
      <body className="h-full font-sans antialiased bg-zinc-950 text-zinc-100">
        <ThemeProvider>
          <PreferencesProvider>
            <BrandingProvider>
              <AuthProvider>
                {children}
                <ToastProvider />
              </AuthProvider>
            </BrandingProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
