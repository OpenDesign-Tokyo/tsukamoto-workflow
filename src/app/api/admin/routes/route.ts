import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_route_templates')
    .select(`
      *,
      document_type:document_types(*),
      steps:approval_route_steps(
        *,
        position:positions(*)
      )
    `)
    .eq('is_active', true)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort steps within each route
  if (data) {
    for (const route of data) {
      if (route.steps) {
        (route.steps as { step_order: number }[]).sort((a, b) => a.step_order - b.step_order)
      }
    }
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { data: route, error } = await supabase
    .from('approval_route_templates')
    .insert({
      document_type_id: body.document_type_id,
      name: body.name,
      is_default: body.is_default ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert steps
  if (body.steps?.length && route) {
    const steps = body.steps.map((s: { step_order: number; name: string; assignee_type: string; assignee_position_id?: string; assignee_employee_id?: string }) => ({
      route_template_id: route.id,
      step_order: s.step_order,
      name: s.name,
      assignee_type: s.assignee_type,
      assignee_position_id: s.assignee_position_id || null,
      assignee_employee_id: s.assignee_employee_id || null,
    }))

    await supabase.from('approval_route_steps').insert(steps)
  }

  return NextResponse.json(route)
}
