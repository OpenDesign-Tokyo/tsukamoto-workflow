import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'

const VENDOR_COLUMNS = 'id, code, name, name_kana, short_name, address, contact_person, contact_email, contact_phone, payment_terms, credit_limit, category, notes, is_active, created_at, updated_at'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return forbidden()

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('vendors').select(VENDOR_COLUMNS).eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  const { id } = await params
  const body = await req.json()

  if (body.code && typeof body.code !== 'string') {
    return NextResponse.json({ error: 'code must be string' }, { status: 400 })
  }
  if (body.contact_email && typeof body.contact_email === 'string' && !/^\S+@\S+\.\S+$/.test(body.contact_email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const k of ['code', 'name', 'name_kana', 'short_name', 'address', 'contact_person', 'contact_email', 'contact_phone', 'payment_terms', 'credit_limit', 'category', 'notes', 'is_active']) {
    if (k in body) updates[k] = body[k] === '' ? null : body[k]
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('id', id)
    .select(VENDOR_COLUMNS)
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `取引先コード "${body.code}" は既に他の取引先で使用されています` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'vendor.update',
    targetType: 'vendor',
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
  // Soft delete: deactivate rather than hard delete to preserve historical
  // applications that reference this vendor_id.
  const { error } = await supabase.from('vendors').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: adminId,
    action: 'vendor.delete',
    targetType: 'vendor',
    targetId: id,
  })

  return NextResponse.json({ success: true })
}
