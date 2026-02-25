import { NextRequest, NextResponse } from 'next/server'
import { archiveToSharePoint } from '@/lib/graph/client'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = await archiveToSharePoint({
    application_number: body.application_number,
    title: body.title,
  })

  return NextResponse.json(result)
}
