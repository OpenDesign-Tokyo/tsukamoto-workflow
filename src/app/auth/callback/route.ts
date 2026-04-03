import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user?.email) {
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
        `${origin}/login?error=${encodeURIComponent('このメールアドレスは登録されていません')}`
      )
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('認証に失敗しました。もう一度お試しください。')}`
  )
}
