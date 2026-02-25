const IS_MOCK = !process.env.MS_GRAPH_CLIENT_ID

export async function sendTeamsNotification(recipientEmail: string, message: { title: string; body: string; actionUrl?: string }) {
  if (IS_MOCK) {
    console.log(`[MOCK Teams] → ${recipientEmail}:`, message)
    return { success: true, mock: true }
  }
  // 本番: Graph API call
  return { success: true, mock: false }
}

export async function archiveToSharePoint(application: { application_number: string; title: string }) {
  if (IS_MOCK) {
    console.log(`[MOCK SharePoint] Archiving:`, application.application_number)
    return { success: true, mock: true, url: '#mock-sharepoint-url' }
  }
  // 本番: Graph API call
  return { success: true, mock: false, url: '' }
}
