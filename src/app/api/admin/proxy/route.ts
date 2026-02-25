import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/logger'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('proxy_settings')
    .select(`
      *,
      principal:employees!principal_id(id, name, email),
      proxy:employees!proxy_id(id, name, email)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('proxy_settings')
    .insert({
      principal_id: body.principal_id,
      proxy_id: body.proxy_id,
      document_type_id: body.document_type_id || null,
      valid_from: body.valid_from,
      valid_until: body.valid_until,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: userId,
    action: 'proxy.create',
    targetType: 'proxy_setting',
    targetId: data.id,
    metadata: { principalId: body.principal_id, proxyId: body.proxy_id },
  })

  return NextResponse.json(data)
}
