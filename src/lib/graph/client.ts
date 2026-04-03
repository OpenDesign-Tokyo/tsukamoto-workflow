import { buildAdaptiveCard } from '@/lib/teams/cards'

const IS_MOCK = !process.env.TEAMS_WEBHOOK_URL

export interface TeamsMessage {
  title: string
  body: string
  actionUrl?: string
  type?: 'approval_request' | 'approved' | 'rejected' | 'reminder' | 'withdrawn'
  applicationNumber?: string
  applicantName?: string
  documentTypeName?: string
  currentStep?: number
  totalSteps?: number
}

export async function sendTeamsNotification(
  recipientEmail: string,
  message: TeamsMessage
): Promise<{ success: boolean; mock: boolean; error?: string }> {
  if (IS_MOCK) {
    console.log(`[MOCK Teams] → ${recipientEmail}:`, message)
    return { success: true, mock: true }
  }

  try {
    const card = buildAdaptiveCard({
      type: message.type || 'approval_request',
      title: message.title,
      body: message.body,
      actionUrl: message.actionUrl || '#',
      applicationNumber: message.applicationNumber,
      applicantName: message.applicantName,
      documentTypeName: message.documentTypeName,
      currentStep: message.currentStep,
      totalSteps: message.totalSteps,
    })

    const payload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: card,
        },
      ],
    }

    const response = await fetch(process.env.TEAMS_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Teams Webhook] Failed (${response.status}):`, text)
      return { success: false, mock: false, error: `Webhook returned ${response.status}` }
    }

    console.log(`[Teams Webhook] Sent to ${recipientEmail}: ${message.title}`)
    return { success: true, mock: false }
  } catch (err) {
    console.error('[Teams Webhook] Error:', err)
    return { success: false, mock: false, error: String(err) }
  }
}

export async function archiveToSharePoint(application: { application_number: string; title: string }) {
  if (!process.env.MS_GRAPH_CLIENT_ID) {
    console.log(`[MOCK SharePoint] Archiving:`, application.application_number)
    return { success: true, mock: true, url: '#mock-sharepoint-url' }
  }
  // 本番: Graph API call
  return { success: true, mock: false, url: '' }
}
