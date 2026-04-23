import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const documentTypeId = req.nextUrl.searchParams.get('document_type_id')
  const today = new Date().toISOString().split('T')[0]
  const supabase = createAdminClient()

  let query = supabase
    .from('proxy_settings')
    .select('id, principal:employees!principal_id(id, name, email)')
    .eq('proxy_id', userId)
    .eq('is_active', true)
    .lte('valid_from', today)
    .gte('valid_until', today)

  if (documentTypeId) {
    query = query.or(`document_type_id.eq.${documentTypeId},document_type_id.is.null`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate principals
  const seen = new Set<string>()
  const principals = (data || [])
    .map(d => d.principal as unknown as { id: string; name: string; email: string })
    .filter(p => {
      if (!p || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

  return NextResponse.json(principals)
}
