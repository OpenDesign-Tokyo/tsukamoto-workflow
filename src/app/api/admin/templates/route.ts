import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_templates')
    .select(`
      *,
      document_type:document_types(*)
    `)
    .eq('is_current', true)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  // Deactivate current version
  if (body.document_type_id) {
    await supabase
      .from('form_templates')
      .update({ is_current: false })
      .eq('document_type_id', body.document_type_id)
      .eq('is_current', true)
  }

  // Get next version
  const { count } = await supabase
    .from('form_templates')
    .select('*', { count: 'exact', head: true })
    .eq('document_type_id', body.document_type_id)

  const { data, error } = await supabase
    .from('form_templates')
    .insert({
      document_type_id: body.document_type_id,
      version: (count || 0) + 1,
      is_current: true,
      schema: body.schema,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
