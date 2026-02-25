import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitApplication } from '@/lib/workflow/engine'

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
      approval_records(
        *,
        approver:employees!approver_id(*)
      )
    `)
    .eq('id', id)
    .single()

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
    .select('id, status, applicant_id')
    .eq('id', id)
    .single()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (app.applicant_id !== userId) {
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

  // If submitting (or resubmitting)
  if (body.submit) {
    updateData.status = 'submitted'
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
