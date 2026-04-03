'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setStoredUserId } from '@/lib/auth/demo-auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@tsukamoto.co.jp"
                required
                autoFocus
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] outline-none transition-colors text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full py-3 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#2d5a8e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* SSO Section (for future Entra ID) */}
          {process.env.NEXT_PUBLIC_AZURE_SSO_ENABLED === 'true' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">または</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signInWithOAuth({
                    provider: 'azure',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback`,
                    },
                  })
                }}
                className="w-full py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Microsoft アカウントでログイン
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/60 mt-6">
          &copy; {new Date().getFullYear()} ツカモト株式会社
        </p>
      </div>
    </div>
  )
}
