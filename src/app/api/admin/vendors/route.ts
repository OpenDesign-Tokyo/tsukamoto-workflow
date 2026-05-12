import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'

const VENDOR_COLUMNS = 'id, code, name, name_kana, short_name, address, contact_person, contact_email, contact_phone, payment_terms, credit_limit, category, notes, is_active, created_at, updated_at'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1'
  const supabase = createAdminClient()

  let q = supabase.from('vendors').select(VENDOR_COLUMNS).order('code', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendors: data ?? [] })
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  const body = await req.json()
  const errors = validateVendorPayload(body)
  if (errors.length) {
    return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      code: body.code,
      name: body.name,
      name_kana: body.name_kana || null,
      short_name: body.short_name || null,
      address: body.address || null,
      contact_person: body.contact_person || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      payment_terms: body.payment_terms || null,
      credit_limit: body.credit_limit ?? null,
      category: body.category || null,
      notes: body.notes || null,
      is_active: body.is_active ?? true,
    })
    .select(VENDOR_COLUMNS)
    .single()

  if (error) {
    // Postgres unique_violation = 23505 (code already exists)
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `取引先コード "${body.code}" は既に登録されています` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'vendor.create',
    targetType: 'vendor',
    targetId: data.id,
    metadata: { code: data.code, name: data.name },
  })

  return NextResponse.json(data)
}

function validateVendorPayload(body: Record<string, unknown>): string[] {
  const errors: string[] = []
  if (!body.code || typeof body.code !== 'string') errors.push('code is required')
  if (!body.name || typeof body.name !== 'string') errors.push('name is required')
  if (body.contact_email && typeof body.contact_email === 'string' && !/^\S+@\S+\.\S+$/.test(body.contact_email)) {
    errors.push('contact_email is not a valid email')
  }
  if (body.credit_limit != null && typeof body.credit_limit !== 'number') {
    errors.push('credit_limit must be a number')
  }
  return errors
}
