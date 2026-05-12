import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit/logger'
import { parseVendorXlsx, type VendorRow } from '@/lib/utils/parseVendorXlsx'

/**
 * POST /api/admin/vendors/import
 *
 * Body: { fileBase64: string }  — the .xlsx file encoded as base64
 *
 * Parses the xlsx, upserts on `code` (existing rows updated, new codes
 * inserted). Returns a summary so the UI can show "n created, m updated".
 *
 * Why base64 in JSON: Next.js API routes use the Web Fetch Request, and
 * keeping JSON-only avoids multipart-form-data plumbing. Vendor files are
 * small (a few hundred rows tops), so the base64 overhead is negligible.
 */
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  let body: { fileBase64?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.fileBase64 || typeof body.fileBase64 !== 'string') {
    return NextResponse.json({ error: 'fileBase64 field is required' }, { status: 400 })
  }

  let buffer: ArrayBuffer
  try {
    const bytes = Buffer.from(body.fileBase64, 'base64')
    buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  } catch (e) {
    return NextResponse.json({ error: `base64 のデコードに失敗しました: ${(e as Error).message}` }, { status: 400 })
  }

  const parsed = parseVendorXlsx(buffer)

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: 'xlsx に不正な行があります', details: parsed.errors },
      { status: 400 },
    )
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'xlsx に有効な行がありません' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Detect which codes already exist so we can report created vs updated.
  const codes = parsed.rows.map(r => r.code)
  const { data: existing } = await supabase.from('vendors').select('code').in('code', codes)
  const existingCodes = new Set((existing ?? []).map(v => (v as { code: string }).code))

  // Filter out keys that are undefined so we don't blank fields the user
  // didn't touch in the spreadsheet (Supabase upsert sets to NULL otherwise).
  const upsertRows = parsed.rows.map(r => {
    const cleaned: Partial<VendorRow> = {}
    for (const [k, v] of Object.entries(r)) {
      if (v !== undefined) (cleaned as Record<string, unknown>)[k] = v
    }
    if (cleaned.is_active === undefined) cleaned.is_active = true
    return cleaned
  })

  const { error } = await supabase.from('vendors').upsert(upsertRows, { onConflict: 'code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const created = parsed.rows.filter(r => !existingCodes.has(r.code)).length
  const updated = parsed.rows.length - created

  await writeAuditLog({
    actorId: adminId,
    action: 'vendor.import',
    targetType: 'vendor',
    targetId: 'bulk',
    metadata: { created, updated, total: parsed.rows.length, format: 'xlsx' },
  })

  return NextResponse.json({ success: true, created, updated, total: parsed.rows.length })
}
