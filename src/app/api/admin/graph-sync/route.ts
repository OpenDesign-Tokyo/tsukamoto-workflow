import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { previewSync, executeSync } from '@/lib/graph/sync'
import { isGraphConfigured } from '@/lib/graph/ms-graph'
import { writeAuditLog } from '@/lib/audit/logger'

async function requireAdmin(req: NextRequest) {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('employees')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle()

  return data?.is_admin ? userId : null
}

// GET: Preview sync changes (dry-run)
export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
