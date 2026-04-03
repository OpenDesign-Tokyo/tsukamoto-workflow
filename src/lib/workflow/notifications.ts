import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeamsNotification } from '@/lib/graph/client'

interface NotificationParams {
  recipientId: string
  applicationId: string
  type: 'approval_request' | 'approved' | 'rejected' | 'reminder' | 'withdrawn'
  title: string
  body: string
  actionUrl: string
  applicationNumber?: string
  applicantName?: string
  documentTypeName?: string
  currentStep?: number
  totalSteps?: number
}

export async function sendWorkflowNotification(params: NotificationParams) {
  const supabase = createAdminClient()

  // Always write to in-app notifications
  await supabase.from('notifications').insert({
    recipient_id: params.recipientId,
    application_id: params.applicationId,
    type: params.type,
    channel: 'in_app',
    title: params.title,
    body: params.body,
    action_url: params.actionUrl,
    is_read: false,
  })

  // Send Teams notification
  const { data: recipient } = await supabase
    .from('employees')
    .select('email')
    .eq('id', params.recipientId)
    .maybeSingle()

  if (recipient) {
    const teamsResult = await sendTeamsNotification(recipient.email, {
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      type: params.type,
      applicationNumber: params.applicationNumber,
      applicantName: params.applicantName,
      documentTypeName: params.documentTypeName,
      currentStep: params.currentStep,
      totalSteps: params.totalSteps,
    })

    // Track Teams delivery if actually sent (not mock)
    if (teamsResult.success && !teamsResult.mock) {
      await supabase.from('notifications').insert({
        recipient_id: params.recipientId,
        application_id: params.applicationId,
        type: params.type,
        channel: 'teams',
        title: params.title,
        body: params.body,
        action_url: params.actionUrl,
        is_read: false,
      })

      if (params.type === 'approval_request') {
        await supabase
          .from('approval_records')
          .update({
            teams_notification_sent: true,
            teams_notification_sent_at: new Date().toISOString(),
          })
          .eq('application_id', params.applicationId)
          .eq('approver_id', params.recipientId)
          .eq('action', 'pending')
      }
    }
  }
}
