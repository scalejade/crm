'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Building2, ChevronLeft, ChevronRight, Sun, Moon, Terminal, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useBranding } from '@/lib/branding-context'
import { usePreferences } from '@/lib/preferences-context'
import { useNavPrefs } from '@/lib/nav-prefs-context'
import { NAV_ITEMS } from '@/lib/nav-items'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

const externalItems = [
  { href: '/docs', label: 'API Docs', icon: Terminal },
]

// Live clock — shows the user's own local time only. Scheduling converts to UTC
// under the hood, so users never have to think about timezones.
function SidebarClock({ collapsed }: { collapsed: boolean }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null // avoid SSR/client hydration mismatch

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hhmmss = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-1 text-[10px] text-zinc-500 tabular-nums" title={tz}>
        <Clock className="w-3.5 h-3.5 mb-0.5" />
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
    )
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="tabular-nums text-zinc-200 font-medium">{hhmmss}</span>
      </div>
      <p className="mt-0.5 pl-5 text-[11px] text-zinc-600 truncate">{tz}</p>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { companyName, logoUrl } = useBranding()
  const { showClock } = usePreferences()
  const { isTabVisible } = useNavPrefs()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item => item.alwaysVisible || isTabVisible(item.key))

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    router.push('/auth/login')
  }

  return (
    <aside className={cn(
      'flex flex-col bg-zinc-900 border-r border-zinc-800 h-full transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo + collapse toggle */}
      <div className="flex items-center h-16 border-b border-zinc-800 px-3 shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="w-7 h-7 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <span className="font-semibold text-zinc-100 text-lg ml-2.5 flex-1 truncate">{companyName}</span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            'p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                active
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && label}
            </Link>
          )
        })}

        {!collapsed && <div className="my-2 border-t border-zinc-800" />}

        {externalItems.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && label}
          </a>
        ))}
      </nav>

      {/* Clock + user + sign out */}
      <div className="px-2 py-4 border-t border-zinc-800 space-y-1">
        {showClock && <SidebarClock collapsed={collapsed} />}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 mb-2 mt-1">
            <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-zinc-400 truncate">{user?.email}</span>
          </div>
        )}
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          className={cn(
            'flex items-center w-full rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2'
          )}
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
        </button>
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex items-center w-full rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
