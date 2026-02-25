import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('form_templates')
    .select(`
      *,
      document_type:document_types(id, name, code, sort_order)
    `)
    .eq('is_current', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort by document_type.sort_order (drag-and-drop order), then created_at desc
  const sorted = (data || []).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const aOrder = (a.document_type as Record<string, number>)?.sort_order ?? 999
    const bOrder = (b.document_type as Record<string, number>)?.sort_order ?? 999
    if (aOrder !== bOrder) return aOrder - bOrder
    return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  })

  return NextResponse.json(sorted)
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
