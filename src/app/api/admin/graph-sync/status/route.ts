import { NextRequest, NextResponse } from 'next/server'
import { isGraphConfigured, testConnection } from '@/lib/graph/ms-graph'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

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
