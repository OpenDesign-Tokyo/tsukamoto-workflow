import { NextRequest, NextResponse } from 'next/server'
import { sendTeamsNotification } from '@/lib/graph/client'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = await sendTeamsNotification(body.recipientEmail, {
    title: body.title,
    body: body.body,
    actionUrl: body.actionUrl,
  })

  return NextResponse.json(result)
}
