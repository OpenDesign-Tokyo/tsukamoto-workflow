import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitApplication } from '@/lib/workflow/engine'
import { selectRouteTemplate } from '@/lib/workflow/route-selector'
import { writeAuditLog } from '@/lib/audit/logger'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const userId = req.headers.get('x-demo-user-id')

  let query = supabase
    .from('applications')
    .select(`
      *,
      document_type:document_types(*),
      applicant:employees!applicant_id(*),
      proxy_applicant:employees!proxy_applicant_id(*)
    `)
    .order('created_at', { ascending: false })

  if (userId) {
    query = query.or(`applicant_id.eq.${userId},proxy_applicant_id.eq.${userId}`)
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

  // Get all active route templates for the document type
  const { data: routeTemplates } = await supabase
    .from('approval_route_templates')
    .select('id, is_default, condition')
    .eq('document_type_id', body.document_type_id)
    .eq('is_active', true)

  if (!routeTemplates?.length) {
    return NextResponse.json({ error: 'No approval route configured' }, { status: 400 })
  }

  // Select route based on conditions (amount-based branching) or fallback to default
  const routeTemplate = selectRouteTemplate(routeTemplates, body.form_data || {})

  if (!routeTemplate) {
    return NextResponse.json({ error: 'No matching approval route' }, { status: 400 })
  }

  // Get total steps
  const { count } = await supabase
    .from('approval_route_steps')
    .select('*', { count: 'exact', head: true })
    .eq('route_template_id', routeTemplate.id)

  // Proxy submission: validate proxy permission if applicant_id differs from current user
  let applicantId = userId
  let proxyApplicantId: string | null = null

  if (body.applicant_id && body.applicant_id !== userId) {
    const today = new Date().toISOString().split('T')[0]
    const { data: proxySetting } = await supabase
      .from('proxy_settings')
      .select('id')
      .eq('proxy_id', userId)
      .eq('principal_id', body.applicant_id)
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_until', today)
      .or(`document_type_id.eq.${body.document_type_id},document_type_id.is.null`)
      .limit(1)
      .maybeSingle()

    if (!proxySetting) {
      return NextResponse.json({ error: '代理申請の権限がありません' }, { status: 403 })
    }

    applicantId = body.applicant_id
    proxyApplicantId = userId
  }

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      document_type_id: body.document_type_id,
      form_template_id: body.form_template_id,
      route_template_id: routeTemplate.id,
      applicant_id: applicantId,
      proxy_applicant_id: proxyApplicantId,
      form_data: body.form_data,
      title: body.title,
      status: body.submit ? 'submitted' : 'draft',
      total_steps: count || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    actorId: userId,
    action: body.submit ? 'application.submit' : 'application.create',
    targetType: 'application',
    targetId: application.id,
    metadata: { title: body.title, documentTypeId: body.document_type_id, proxyApplicantId: proxyApplicantId },
  })

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
