'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Building2 } from 'lucide-react'
import { useBranding } from '@/lib/branding-context'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) toast.error(err)
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4 bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  )
}

export default function LoginPage() {
  const { companyName, logoUrl } = useBranding()
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-14 h-14 rounded-2xl object-cover mb-3" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-zinc-100">{companyName}</h1>
          <p className="text-zinc-400 mt-1 text-sm">Sign in to your workspace</p>
        </div>

        <Suspense fallback={<div className="h-48 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-zinc-400 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
