import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'

const POSITION_COLUMNS = 'id, name, code, rank, is_active, created_at, updated_at'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  for (const k of ['name', 'code', 'rank', 'is_active']) {
    if (k in body) updates[k] = body[k] === '' ? null : body[k]
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('positions')
    .update(updates)
    .eq('id', id)
    .select(POSITION_COLUMNS)
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `役職名 "${body.name}" は既に他の役職で使用されています` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'position.update',
    targetType: 'position',
    targetId: id,
    metadata: { changedKeys: Object.keys(updates) },
  })

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  const { id } = await params
  const supabase = createAdminClient()

  // Block hard-delete if any active employee_assignments still reference this position.
  const { count } = await supabase
    .from('employee_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('position_id', id)
    .eq('is_active', true)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `この役職は ${count} 名の社員に割り当てられているため削除できません。先に各社員の役職を変更してください。` },
      { status: 400 },
    )
  }

  // Soft-delete (deactivate) to preserve historical assignments.
  const { error } = await supabase.from('positions').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: adminId,
    action: 'position.delete',
    targetType: 'position',
    targetId: id,
  })

  return NextResponse.json({ success: true })
}
