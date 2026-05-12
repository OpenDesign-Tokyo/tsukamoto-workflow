import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, forbidden } from '@/lib/auth/require-admin'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_route_templates')
    .select(`
      *,
      document_type:document_types(*),
      steps:approval_route_steps(
        *,
        position:positions(*)
      ),
      observers:approval_route_observers(
        id, notify_on, employee_id,
        employee:employees(id, name, email)
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

interface ObserverPayload { employee_id: string; notify_on?: string }

async function replaceObservers(
  supabase: ReturnType<typeof createAdminClient>,
  routeId: string,
  observers: ObserverPayload[],
) {
  await supabase.from('approval_route_observers').delete().eq('route_template_id', routeId)
  if (!observers.length) return
  const rows = observers
    .filter(o => o.employee_id)
    .map(o => ({
      route_template_id: routeId,
      employee_id: o.employee_id,
      notify_on: o.notify_on || 'approved',
    }))
  if (rows.length) await supabase.from('approval_route_observers').insert(rows)
}

export { replaceObservers }

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden()

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
    const steps = body.steps.map((s: { step_order: number; name: string; assignee_type: string; assignee_position_id?: string; assignee_employee_id?: string; approval_type?: string; allow_dynamic_selection?: boolean }) => ({
      route_template_id: route.id,
      step_order: s.step_order,
      name: s.name,
      assignee_type: s.assignee_type,
      assignee_position_id: s.assignee_position_id || null,
      assignee_employee_id: s.assignee_employee_id || null,
      approval_type: s.approval_type || 'single',
      allow_dynamic_selection: s.allow_dynamic_selection || false,
    }))

    await supabase.from('approval_route_steps').insert(steps)
  }

  if (Array.isArray(body.observers) && route) {
    await replaceObservers(supabase, route.id, body.observers)
  }

  return NextResponse.json(route)
}
