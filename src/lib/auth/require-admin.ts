import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAdmin(req: NextRequest): Promise<string | null> {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('employees')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle()

  return data?.is_admin ? userId : null
}

export function forbidden() {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
}
