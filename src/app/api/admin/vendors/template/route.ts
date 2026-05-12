import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'
import { generateVendorTemplate } from '@/lib/utils/generateVendorTemplate'

/**
 * GET /api/admin/vendors/template
 *
 * Returns a styled xlsx template (Japanese headers + 3 sample rows + ガイドシート)
 * that the user fills in and re-uploads via /api/admin/vendors/import.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

  const buffer = await generateVendorTemplate()

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vendors_template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
