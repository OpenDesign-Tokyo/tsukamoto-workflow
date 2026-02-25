import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWorkflowNotification } from '@/lib/workflow/notifications'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const userId = req.headers.get('x-demo-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  // Get application
  const { data: app } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*)')
    .eq('id', id)
    .single()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (app.applicant_id !== userId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Can only withdraw if submitted or in_approval
  if (app.status !== 'submitted' && app.status !== 'in_approval') {
    return NextResponse.json({ error: 'Cannot withdraw this application' }, { status: 400 })
  }

  // Get current pending approver to notify
  const { data: pendingRecords } = await supabase
    .from('approval_records')
    .select('approver_id')
    .eq('application_id', id)
    .eq('action', 'pending')

  // Update application status to withdrawn
  const { error } = await supabase
    .from('applications')
    .update({
      status: 'withdrawn',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cancel pending approval records
  await supabase
    .from('approval_records')
    .update({
      action: 'skipped',
      comment: '申請者により取下げ',
      acted_at: new Date().toISOString(),
    })
    .eq('application_id', id)
    .eq('action', 'pending')

  // Notify pending approvers
  if (pendingRecords) {
    for (const record of pendingRecords) {
      await sendWorkflowNotification({
        recipientId: record.approver_id,
        applicationId: id,
        type: 'withdrawn',
        title: `取下げ: ${app.title}`,
        body: `${(app.applicant as { name: string }).name}さんが「${app.title}」を取り下げました。`,
        actionUrl: `/applications/${id}`,
      })
    }
  }

  return NextResponse.json({ success: true })
}
