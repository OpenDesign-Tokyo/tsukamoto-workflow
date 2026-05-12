import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/get-user'

/**
 * GET /api/vendors — read-only vendor list for form rendering.
 *
 * Any authenticated user can read the active vendor list (used by vendor_select
 * fields). Filtering / pagination kept simple for now since the master is small;
 * if the list grows past a few thousand rows, paginate + add full-text search.
 */
export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const category = req.nextUrl.searchParams.get('category')
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1'

  const supabase = createAdminClient()
  let query = supabase
    .from('vendors')
    .select('id, code, name, name_kana, short_name, address, contact_person, contact_email, contact_phone, payment_terms, credit_limit, category, notes, is_active')
    .order('name', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendors: data ?? [] })
}
