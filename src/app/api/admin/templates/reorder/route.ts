import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Update display order of templates by updating their document_type's sort_order
export async function PUT(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  // Expects: { order: [{ document_type_id: string, sort_order: number }] }
  const items = body.order as { document_type_id: string; sort_order: number }[]

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  for (const item of items) {
    const { error } = await supabase
      .from('document_types')
      .update({ sort_order: item.sort_order })
      .eq('id', item.document_type_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
