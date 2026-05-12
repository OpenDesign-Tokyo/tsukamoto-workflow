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
    // For approval requests, embed inline 承認 / 差戻し buttons so the approver
    // can act from Teams. Gated behind TEAMS_INLINE_APPROVAL_ENABLED to avoid
    // showing buttons that won't work until Power Automate + TEAMS_ACTION_SECRET
    // are configured (see docs/POWER_AUTOMATE_TEAMS_ACTION.md). Default = off,
    // so承認 falls back to the "詳細を見る" web link.
    const inlineApproval = process.env.TEAMS_INLINE_APPROVAL_ENABLED === 'true'
                        || process.env.TEAMS_INLINE_APPROVAL_ENABLED === '1'
    const approverActions = params.type === 'approval_request' && inlineApproval
      ? { applicationId: params.applicationId, approverId: params.recipientId }
      : undefined

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
      approverActions,
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

  // CC all admin users (in-app + Teams) so they can monitor all flows
  await notifyAdmins(params)

  // Notify route-level observers ("閲覧者") based on their notify_on setting.
  // Failures here are intentionally swallowed — observer notifications should
  // never block the primary workflow.
  try {
    await notifyObservers(params)
  } catch (e) {
    console.error('[notifications] observer通知失敗:', e)
  }
}

/**
 * 承認ルートに紐付く閲覧者(オブザーバー)に通知を配信する。
 *
 * notify_on とイベントのマッピング:
 *   - approval_request (提出 / ステップ進行) → 'submit' / 'each_step' / 'all'
 *   - approved (最終承認完了)              → 'approved' / 'all'
 *   - rejected (差戻し)                    → 'rejected' / 'all'
 *   - withdrawn (取下げ)                   → 'all'
 *   - reminder                             → 'all'
 */
async function notifyObservers(params: NotificationParams) {
  const supabase = createAdminClient()

  // ルートテンプレートIDを取得
  const { data: app } = await supabase
    .from('applications')
    .select('route_template_id')
    .eq('id', params.applicationId)
    .maybeSingle()
  if (!app?.route_template_id) return

  const { data: rows } = await supabase
    .from('approval_route_observers')
    .select(`
      employee_id, notify_on,
      employee:employees(id, name, email, is_active)
    `)
    .eq('route_template_id', app.route_template_id)
  if (!rows?.length) return

  const triggerMap: Record<string, string[]> = {
    approval_request: ['submit', 'each_step', 'all'],
    approved: ['approved', 'all'],
    rejected: ['rejected', 'all'],
    withdrawn: ['all'],
    reminder: ['all'],
  }
  const matchingTriggers = triggerMap[params.type] || []

  type ObsRow = {
    employee_id: string
    notify_on: string
    employee?: { id: string; name: string; email: string; is_active: boolean } | null
  }

  const observers = (rows as unknown as ObsRow[]).filter(o =>
    o.employee &&
    o.employee.is_active &&
    matchingTriggers.includes(o.notify_on) &&
    o.employee_id !== params.recipientId, // 同一人物への二重通知を避ける
  )

  for (const obs of observers) {
    if (!obs.employee) continue
    const title = `[閲覧] ${params.title}`

    // アプリ内通知
    await supabase.from('notifications').insert({
      recipient_id: obs.employee_id,
      application_id: params.applicationId,
      type: params.type,
      channel: 'in_app',
      title,
      body: params.body,
      action_url: params.actionUrl,
      is_read: false,
    })

    // Teams 通知（観察者には承認ボタンを付けない=approverActions渡さない）
    const result = await sendTeamsNotification(obs.employee.email, {
      title,
      body: params.body,
      actionUrl: params.actionUrl,
      type: params.type,
      applicationNumber: params.applicationNumber,
      applicantName: params.applicantName,
      documentTypeName: params.documentTypeName,
      currentStep: params.currentStep,
      totalSteps: params.totalSteps,
    })

    if (result.success && !result.mock) {
      await supabase.from('notifications').insert({
        recipient_id: obs.employee_id,
        application_id: params.applicationId,
        type: params.type,
        channel: 'teams',
        title,
        body: params.body,
        action_url: params.actionUrl,
        is_read: false,
      })
    }
  }
}

async function notifyAdmins(params: NotificationParams) {
  const supabase = createAdminClient()

  const { data: admins } = await supabase
    .from('employees')
    .select('id, email')
    .eq('is_admin', true)
    .eq('is_active', true)

  if (!admins?.length) return

  for (const admin of admins) {
    // Skip if admin is already the recipient
    if (admin.id === params.recipientId) continue

    // In-app notification for admin
    await supabase.from('notifications').insert({
      recipient_id: admin.id,
      application_id: params.applicationId,
      type: params.type,
      channel: 'in_app',
      title: `[管理者CC] ${params.title}`,
      body: params.body,
      action_url: params.actionUrl,
      is_read: false,
    })

    // Teams notification for admin
    const teamsResult = await sendTeamsNotification(admin.email, {
      title: `[管理者CC] ${params.title}`,
      body: params.body,
      actionUrl: params.actionUrl,
      type: params.type,
      applicationNumber: params.applicationNumber,
      applicantName: params.applicantName,
      documentTypeName: params.documentTypeName,
      currentStep: params.currentStep,
      totalSteps: params.totalSteps,
    })

    if (teamsResult.success && !teamsResult.mock) {
      await supabase.from('notifications').insert({
        recipient_id: admin.id,
        application_id: params.applicationId,
        type: params.type,
        channel: 'teams',
        title: `[管理者CC] ${params.title}`,
        body: params.body,
        action_url: params.actionUrl,
        is_read: false,
      })
    }
  }
}
