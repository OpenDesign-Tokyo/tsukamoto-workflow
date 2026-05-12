import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'

const POSITION_COLUMNS = 'id, name, code, rank, is_active, created_at, updated_at'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1'
  const supabase = createAdminClient()

  let q = supabase
    .from('positions')
    .select(POSITION_COLUMNS)
    .order('rank', { ascending: false })
    .order('name', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count how many employee_assignments reference each position (for delete safety + UI hints).
  const { data: counts } = await supabase
    .from('employee_assignments')
    .select('position_id')
    .eq('is_active', true)

  const usage = new Map<string, number>()
  for (const row of (counts || []) as { position_id: string | null }[]) {
    if (!row.position_id) continue
    usage.set(row.position_id, (usage.get(row.position_id) ?? 0) + 1)
  }

  const positions = (data || []).map(p => ({ ...p, usage_count: usage.get(p.id) ?? 0 }))
  return NextResponse.json({ positions })
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  const body = await req.json()
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: '役職名は必須です' }, { status: 400 })
  }
  if (body.rank != null && typeof body.rank !== 'number') {
    return NextResponse.json({ error: 'rankは数値で指定してください' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('positions')
    .insert({
      name: body.name.trim(),
      code: body.code || null,
      rank: body.rank ?? 0,
      is_active: body.is_active ?? true,
    })
    .select(POSITION_COLUMNS)
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `役職名 "${body.name}" は既に登録されています` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'position.create',
    targetType: 'position',
    targetId: data.id,
    metadata: { name: data.name, source: 'manual' },
  })

  return NextResponse.json(data)
}
