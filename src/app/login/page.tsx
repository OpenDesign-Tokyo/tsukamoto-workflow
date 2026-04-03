'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setStoredUserId } from '@/lib/auth/demo-auth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Handle SSO callback redirect
  useEffect(() => {
    const ssoEid = searchParams.get('sso_eid')
    if (ssoEid) {
      setStoredUserId(ssoEid)
      router.replace('/')
      return
    }
    const ssoError = searchParams.get('error')
    if (ssoError) {
      setError(ssoError)
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data: employee } = await supabase
        .from('employees')
        .select('id, name, is_active')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (!employee) {
        setError('登録されていないメールアドレスです')
        setIsLoading(false)
        return
      }

      if (!employee.is_active) {
        setError('このアカウントは無効化されています')
        setIsLoading(false)
        return
      }

      setStoredUserId(employee.id)
      router.push('/')
    } catch {
      setError('ログインに失敗しました。もう一度お試しください。')
      setIsLoading(false)
    }
  }

  const handleSSOLogin = async () => {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo / Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">
              ツカモトワークフロー
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              承認管理システム
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          {/* Microsoft 365 SSO - Primary Login */}
          <button
            type="button"
            onClick={handleSSOLogin}
            disabled={isLoading}
            className="w-full py-3.5 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#2d5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            {isLoading ? 'ログイン中...' : 'Microsoft 365 でログイン'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            会社の Microsoft 365 アカウントでログインしてください
          </p>

          {/* Demo email login - collapsible */}
          <details className="mt-8">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500 text-center">
              メールアドレスで直接ログイン（デモ用）
            </summary>
            <form onSubmit={handleLogin} className="mt-4 space-y-4">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@tsukamoto.co.jp"
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] outline-none transition-colors text-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          </details>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">
          &copy; {new Date().getFullYear()} ツカモト株式会社
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
