import { NextRequest, NextResponse } from 'next/server'
import { rejectApplication } from '@/lib/workflow/engine'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = req.headers.get('x-demo-user-id')
  const body = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  if (!body.comment?.trim()) {
    return NextResponse.json({ error: 'Comment required for rejection' }, { status: 400 })
  }

  const result = await rejectApplication(id, userId, body.comment)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result)
}
