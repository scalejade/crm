'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Users, Tag, Kanban, LayoutDashboard, LogOut, Building2,
  HardDrive, FileCode2, Settings, Sun, Moon, FileText, Mail, Menu, X, Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useBranding } from '@/lib/branding-context'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/companies', label: 'Companies', icon: Building2 },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/dashboard/tags', label: 'Tags', icon: Tag },
  { href: '/dashboard/emails', label: 'Emails', icon: Mail },
  { href: '/dashboard/templates', label: 'Templates', icon: FileCode2 },
  { href: '/dashboard/md', label: 'Markdown', icon: FileText },
  { href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/developer', label: 'Developer', icon: Terminal },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { companyName, logoUrl } = useBranding()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    router.push('/auth/login')
  }

  return (
    <>
      {/* Top app bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 bg-zinc-900 border-b border-zinc-800 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-6 h-6 rounded-md object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="font-semibold text-zinc-100 text-base">{companyName}</span>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-72 bg-zinc-900 flex flex-col transition-transform duration-300 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Drawer header */}
        <div className="flex items-center h-14 border-b border-zinc-800 px-4 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-7 h-7 rounded-lg object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-zinc-100 text-lg ml-2.5 flex-1">{companyName}</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User + actions */}
        <div className="px-2 py-4 border-t border-zinc-800 space-y-1">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-zinc-400 truncate">{user?.email}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
