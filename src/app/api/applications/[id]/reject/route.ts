import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectApplication } from '@/lib/workflow/engine'
import { writeAuditLog } from '@/lib/audit/logger'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = req.headers.get('x-demo-user-id')
  const body = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  if (!body.comment?.trim()) {
    return NextResponse.json({ error: 'Comment required for rejection' }, { status: 400 })
  }

  const result = await rejectApplication(id, userId, body.comment)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await writeAuditLog({
    actorId: userId,
    action: 'application.reject',
    targetType: 'application',
    targetId: id,
    metadata: { comment: body.comment },
  })

  // Return updated application for immediate UI refresh
  const supabase = createAdminClient()
  const { data: application } = await supabase
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
    .maybeSingle()

  if (application?.approval_records) {
    application.approval_records.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)
  }

  return NextResponse.json({ ...result, application })
}
