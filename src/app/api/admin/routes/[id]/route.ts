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
    .from('approval_route_templates')
    .update({
      name: body.name,
      is_default: body.is_default,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace steps if provided
  if (body.steps) {
    await supabase
      .from('approval_route_steps')
      .delete()
      .eq('route_template_id', id)

    if (body.steps.length) {
      const steps = body.steps.map((s: { step_order: number; name: string; assignee_type: string; assignee_position_id?: string; assignee_employee_id?: string }) => ({
        route_template_id: id,
        step_order: s.step_order,
        name: s.name,
        assignee_type: s.assignee_type,
        assignee_position_id: s.assignee_position_id || null,
        assignee_employee_id: s.assignee_employee_id || null,
      }))

      await supabase.from('approval_route_steps').insert(steps)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('approval_route_templates')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
