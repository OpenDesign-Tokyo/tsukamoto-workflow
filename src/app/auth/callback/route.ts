import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Azure may redirect back with error params instead of code
  if (errorParam) {
    console.error('[SSO Callback] OAuth error:', errorParam, errorDescription)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || `認証エラー: ${errorParam}`)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[SSO Callback] Exchange error:', error.message)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(`認証エラー: ${error.message}`)}`
      )
    }

    if (data?.user?.email) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('email', data.user.email)
        .eq('is_active', true)
        .maybeSingle()

      if (employee) {
        return NextResponse.redirect(`${origin}/login?sso_eid=${employee.id}`)
      }

      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(`このメールアドレス（${data.user.email}）は登録されていません`)}`
      )
    }

    console.error('[SSO Callback] No email in user data:', data?.user)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('メールアドレスを取得できませんでした')}`
    )
  }

  console.error('[SSO Callback] No code or error in callback URL:', request.url)
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('認証に失敗しました。もう一度お試しください。')}`
  )
}
