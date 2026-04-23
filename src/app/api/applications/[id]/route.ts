import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitApplication } from '@/lib/workflow/engine'
import { selectRouteTemplate } from '@/lib/workflow/route-selector'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      document_type:document_types(*),
      form_template:form_templates(*),
      applicant:employees!applicant_id(*),
      proxy_applicant:employees!proxy_applicant_id(*),
      approval_records(
        *,
        approver:employees!approver_id(*)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort approval records by step_order
  if (data?.approval_records) {
    data.approval_records.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)
  }

  return NextResponse.json(data)
}

// PUT: Update draft application
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  // Check application exists and is editable
  const { data: app } = await supabase
    .from('applications')
    .select('id, status, applicant_id, proxy_applicant_id, document_type_id')
    .eq('id', id)
    .maybeSingle()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (app.applicant_id !== userId && app.proxy_applicant_id !== userId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (app.status !== 'draft' && app.status !== 'rejected') {
    return NextResponse.json({ error: 'Application is not editable' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    form_data: body.form_data,
    title: body.title,
    updated_at: new Date().toISOString(),
  }

  // If submitting (or resubmitting), re-evaluate route based on form_data
  if (body.submit) {
    updateData.status = 'submitted'

    const { data: routeTemplates } = await supabase
      .from('approval_route_templates')
      .select('id, is_default, condition')
      .eq('document_type_id', app.document_type_id)
      .eq('is_active', true)

    if (routeTemplates?.length) {
      const selected = selectRouteTemplate(routeTemplates, body.form_data || {})
      if (selected) {
        const { count } = await supabase
          .from('approval_route_steps')
          .select('*', { count: 'exact', head: true })
          .eq('route_template_id', selected.id)

        updateData.route_template_id = selected.id
        updateData.total_steps = count || 0
      }
    }
  }

  const { data, error } = await supabase
    .from('applications')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If submitting, start workflow
  if (body.submit && data) {
    // Clear old approval records if resubmitting
    if (app.status === 'rejected') {
      await supabase
        .from('approval_records')
        .delete()
        .eq('application_id', id)
    }

    const result = await submitApplication(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error, application: data }, { status: 400 })
    }
    return NextResponse.json({ ...data, workflow: result })
  }

  return NextResponse.json(data)
}
