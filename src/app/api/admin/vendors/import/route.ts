import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'
import { parseVendorCsv, type VendorCsvRow } from '@/lib/utils/parseVendorCsv'

/**
 * POST /api/admin/vendors/import
 *
 * Body: { csv: string }  — the raw CSV text (UTF-8)
 *
 * Parses the CSV, upserts on `code` (existing rows are updated, new codes
 * inserted). Returns a summary so the UI can show "n created, m updated".
 */
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  let body: { csv?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.csv || typeof body.csv !== 'string') {
    return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
  }

  let parsed: { rows: VendorCsvRow[]; errors: string[] }
  try {
    parsed = parseVendorCsv(body.csv)
  } catch (e) {
    return NextResponse.json({ error: `CSVのパースに失敗しました: ${(e as Error).message}` }, { status: 400 })
  }

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'CSVに不正な行があります', details: parsed.errors }, { status: 400 })
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'CSVに有効な行がありません' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Detect which codes already exist so we can report created vs updated.
  const codes = parsed.rows.map(r => r.code)
  const { data: existing } = await supabase.from('vendors').select('code').in('code', codes)
  const existingCodes = new Set((existing ?? []).map(v => (v as { code: string }).code))

  const { error } = await supabase
    .from('vendors')
    .upsert(parsed.rows.map(r => ({ ...r, is_active: r.is_active ?? true })), { onConflict: 'code' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const created = parsed.rows.filter(r => !existingCodes.has(r.code)).length
  const updated = parsed.rows.length - created

  await writeAuditLog({
    actorId: adminId,
    action: 'vendor.import',
    targetType: 'vendor',
    targetId: 'bulk',
    metadata: { created, updated, total: parsed.rows.length },
  })

  return NextResponse.json({ success: true, created, updated, total: parsed.rows.length })
}
