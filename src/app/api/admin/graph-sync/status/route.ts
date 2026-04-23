import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isGraphConfigured, testConnection } from '@/lib/graph/ms-graph'

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('employees')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (!data?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  if (!isGraphConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: 'AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET が設定されていません',
    })
  }

  const result = await testConnection()
  return NextResponse.json({
    configured: true,
    ...result,
  })
}
