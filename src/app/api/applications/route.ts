import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitApplication } from '@/lib/workflow/engine'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const userId = req.headers.get('x-demo-user-id')

  let query = supabase
    .from('applications')
    .select(`
      *,
      document_type:document_types(*),
      applicant:employees!applicant_id(*)
    `)
    .order('created_at', { ascending: false })

  if (userId) {
    query = query.eq('applicant_id', userId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  // Get default route template for the document type
  const { data: routeTemplate } = await supabase
    .from('approval_route_templates')
    .select('id')
    .eq('document_type_id', body.document_type_id)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (!routeTemplate) {
    return NextResponse.json({ error: 'No approval route configured' }, { status: 400 })
  }

  // Get total steps
  const { count } = await supabase
    .from('approval_route_steps')
    .select('*', { count: 'exact', head: true })
    .eq('route_template_id', routeTemplate.id)

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      document_type_id: body.document_type_id,
      form_template_id: body.form_template_id,
      route_template_id: routeTemplate.id,
      applicant_id: userId,
      form_data: body.form_data,
      title: body.title,
      status: body.submit ? 'submitted' : 'draft',
      total_steps: count || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If submitting, start workflow
  if (body.submit && application) {
    const result = await submitApplication(application.id)
    if (!result.success) {
      return NextResponse.json({ error: result.error, application }, { status: 400 })
    }
    return NextResponse.json({ ...application, workflow: result })
  }

  return NextResponse.json(application)
}
