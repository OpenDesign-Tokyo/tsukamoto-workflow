import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeamsNotification } from '@/lib/graph/client'

interface NotificationParams {
  recipientId: string
  applicationId: string
  type: 'approval_request' | 'approved' | 'rejected' | 'reminder' | 'withdrawn'
  title: string
  body: string
  actionUrl: string
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

  // Also send Teams notification (mock)
  const { data: recipient } = await supabase
    .from('employees')
    .select('email')
    .eq('id', params.recipientId)
    .single()

  if (recipient) {
    await sendTeamsNotification(recipient.email, {
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
    })
  }
}
