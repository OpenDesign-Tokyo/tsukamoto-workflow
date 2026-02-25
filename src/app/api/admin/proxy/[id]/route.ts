import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/logger'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('proxy_settings')
    .update({
      principal_id: body.principal_id,
      proxy_id: body.proxy_id,
      valid_from: body.valid_from,
      valid_until: body.valid_until,
      is_active: body.is_active ?? true,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: userId,
    action: 'proxy.update',
    targetType: 'proxy_setting',
    targetId: id,
    metadata: { principalId: body.principal_id, proxyId: body.proxy_id },
  })

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const { error } = await supabase
    .from('proxy_settings')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: userId,
    action: 'proxy.delete',
    targetType: 'proxy_setting',
    targetId: id,
  })

  return NextResponse.json({ success: true })
}
