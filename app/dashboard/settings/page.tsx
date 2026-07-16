'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useBranding } from '@/lib/branding-context'
import { usePreferences } from '@/lib/preferences-context'
import type { UserProfile, SmtpConfig } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Users, Settings, Loader2, Mail, Server, Lock,
  User, CheckCircle2, Eye, EyeOff, Building2, Upload, Trash2, Image as ImageIcon, Clock, SlidersHorizontal, PanelLeft,
} from 'lucide-react'
import { useNavPrefs } from '@/lib/nav-prefs-context'
import { NAV_ITEMS } from '@/lib/nav-items'
import { formatDistanceToNow, format } from 'date-fns'

// ─── Users tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.schema('crm')
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        else setProfiles(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">{profiles.length} registered user{profiles.length !== 1 ? 's' : ''}</p>
      {profiles.map(p => (
        <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
            {p.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-100 truncate">{p.email}</p>
              {p.id === currentUser?.id && (
                <span className="text-xs bg-indigo-900/50 text-indigo-400 border border-indigo-800/50 rounded-full px-2 py-0.5 shrink-0">you</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Joined {format(new Date(p.created_at), 'MMM d, yyyy')}
              <span className="text-zinc-600 ml-1">({formatDistanceToNow(new Date(p.created_at), { addSuffix: true })})</span>
            </p>
          </div>
          <User className="w-4 h-4 text-zinc-600 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── SMTP tab ─────────────────────────────────────────────────────────────────

function SmtpTab() {
  const { user } = useAuth()
  const [config, setConfig] = useState<SmtpConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [secure, setSecure] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')

  const fetchConfig = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.schema('crm')
      .from('smtp_configs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setConfig(data)
      setHost(data.host)
      setPort(String(data.port))
      setSecure(data.secure)
      setUsername(data.username)
      setPassword(data.password)
      setFromName(data.from_name)
      setFromEmail(data.from_email)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const payload = {
      host: host.trim(),
      port: parseInt(port) || 587,
      secure,
      username: username.trim(),
      password,
      from_name: fromName.trim(),
      from_email: fromEmail.trim(),
      updated_at: new Date().toISOString(),
    }
    if (config) {
      const { error } = await supabase.schema('crm').from('smtp_configs').update(payload).eq('id', config.id)
      if (error) toast.error(error.message)
      else { toast.success('SMTP settings saved'); fetchConfig() }
    } else {
      const { error } = await supabase.schema('crm').from('smtp_configs').insert({ ...payload, user_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('SMTP settings saved'); fetchConfig() }
    }
    setSaving(false)
  }

  const handleTest = async () => {
    if (!user) return
    if (!host || !username || !password) {
      toast.error('Fill in host, username and password first')
      return
    }
    setTesting(true)
    try {
      const { error } = await supabase.functions.invoke('send-custom-email', {
        body: {
          to: user.email,
          subject: 'CRM SMTP Test',
          htmlContent: '<p>Your SMTP configuration is working correctly.</p>',
          smtpOverride: { host, port: parseInt(port) || 587, secure, username, password, fromName, fromEmail },
        },
      })
      if (error) throw error
      toast.success(`Test email sent to ${user.email}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Test failed')
    }
    setTesting(false)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
  }

  return (
    <div className="space-y-6 max-w-xl">
      {config && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          SMTP configured
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> SMTP Host</Label>
          <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" />
        </div>

        <div className="space-y-1.5">
          <Label>Port</Label>
          <Input
            type="number"
            value={port}
            onChange={e => setPort(e.target.value)}
            placeholder="587"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Security</Label>
          <div className="flex items-center gap-3 h-10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!secure}
                onChange={() => { setSecure(false); if (port === '465') setPort('587') }}
                className="accent-indigo-500"
              />
              <span className="text-sm text-zinc-300">STARTTLS (587)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={secure}
                onChange={() => { setSecure(true); setPort('465') }}
                className="accent-indigo-500"
              />
              <span className="text-sm text-zinc-300">SSL/TLS (465)</span>
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Username</Label>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="you@gmail.com" autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Password / App password</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>From Name</Label>
          <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Acme Sales" />
        </div>

        <div className="space-y-1.5">
          <Label>From Email</Label>
          <Input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="sales@acme.com" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
        <Button variant="ghost" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send Test Email
        </Button>
      </div>
    </div>
  )
}

// ─── Branding tab ─────────────────────────────────────────────────────────────

const MAX_LOGO_BYTES = 512 * 1024 // 512 KB

function BrandingTab() {
  const { companyName: currentName, logoUrl: currentLogo, refresh } = useBranding()
  const [companyName, setCompanyName] = useState(currentName)
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogo)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Keep the form in sync once branding finishes loading.
  useEffect(() => { setCompanyName(currentName); setLogoUrl(currentLogo) }, [currentName, currentLogo])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (file.size > MAX_LOGO_BYTES) { toast.error('Logo must be under 512 KB'); return }
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!companyName.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    const { error } = await supabase.schema('crm').from('branding').update({
      company_name: companyName.trim(),
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    if (error) toast.error(error.message)
    else { toast.success('Branding updated'); await refresh() }
    setSaving(false)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label>Company logo</Label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo preview" className="w-16 h-16 rounded-xl object-cover border border-zinc-700" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> {logoUrl ? 'Replace' : 'Upload'} logo
            </Button>
            {logoUrl && (
              <Button size="sm" variant="ghost" onClick={() => setLogoUrl(null)}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" /> Square PNG/SVG under 512 KB works best. Falls back to a default icon.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Company name</Label>
        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Inc" />
        <p className="text-xs text-zinc-500">Shown in the sidebar, mobile header, and the login screen.</p>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Branding
      </Button>
    </div>
  )
}

// ─── Preferences tab (device-local, not saved to the database) ────────────────

function PreferencesTab() {
  const { showClock, setShowClock } = usePreferences()

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Show clock in sidebar
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Displays the current local time and timezone.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showClock}
          onClick={() => setShowClock(!showClock)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${showClock ? 'bg-indigo-600' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showClock ? 'translate-x-4' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-zinc-600">This preference is stored on this device only.</p>
    </div>
  )
}

// ─── Sidebar tab (per-user, saved to the database) ────────────────────────────

function SidebarTab() {
  const { loaded, isTabVisible, setTabVisible } = useNavPrefs()

  const handleToggle = async (key: string, visible: boolean) => {
    try {
      await setTabVisible(key, visible)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  if (!loaded) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg space-y-1">
      <p className="text-sm text-zinc-400 mb-4">
        Choose which tabs appear in the sidebar. All tabs are shown by default.
      </p>
      {NAV_ITEMS.map(({ key, label, icon: Icon, alwaysVisible }) => {
        const visible = alwaysVisible || isTabVisible(key)
        return (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <p className="text-sm font-medium text-zinc-100 flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 text-indigo-400 shrink-0" /> {label}
            </p>
            {alwaysVisible ? (
              <span className="text-xs text-zinc-600 shrink-0">Always shown</span>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={visible}
                onClick={() => handleToggle(key, !visible)}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${visible ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${visible ? 'translate-x-4' : ''}`} />
              </button>
            )}
          </div>
        )
      })}
      <p className="text-xs text-zinc-600 pt-3">Saved to your account and applied on every device.</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage users and configure your email settings</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Branding
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> SMTP
          </TabsTrigger>
          <TabsTrigger value="sidebar" className="flex items-center gap-1.5">
            <PanelLeft className="w-3.5 h-3.5" /> Sidebar
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="smtp">
          <SmtpTab />
        </TabsContent>
        <TabsContent value="sidebar">
          <SidebarTab />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
