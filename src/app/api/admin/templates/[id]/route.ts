import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('form_templates')
    .update({ schema: body.schema })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Check if template is used by any applications
  const { count } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('form_template_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `このテンプレートは ${count} 件の申請で使用されているため削除できません` },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('form_templates')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
