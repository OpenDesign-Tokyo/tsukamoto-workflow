import { NextRequest, NextResponse } from 'next/server'
import { previewSync, executeSync } from '@/lib/graph/sync'
import { isGraphConfigured } from '@/lib/graph/ms-graph'
import { writeAuditLog } from '@/lib/audit/logger'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'

// GET: Preview sync changes (dry-run)
export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  if (!isGraphConfigured()) {
    return NextResponse.json({ error: 'Microsoft Graph API is not configured' }, { status: 400 })
  }

  try {
    const result = await previewSync()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: Execute sync
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return forbidden()

  if (!isGraphConfigured()) {
    return NextResponse.json({ error: 'Microsoft Graph API is not configured' }, { status: 400 })
  }

  try {
    const result = await executeSync()

    await writeAuditLog({
      actorId: adminId,
      action: 'graph_sync.execute',
      targetType: 'system',
      targetId: 'graph-sync',
      metadata: result.summary,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
