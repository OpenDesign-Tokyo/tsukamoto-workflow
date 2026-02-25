import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApprover } from './resolver'
import { sendWorkflowNotification } from './notifications'
import type { WorkflowSubmitResult, WorkflowApproveResult, WorkflowRejectResult } from '@/lib/types/workflow'

/**
 * 申請送信時:
 * 1. applications を submitted に更新
 * 2. 承認ルートテンプレートから全ステップを取得
 * 3. step_order=1 の承認者を resolver で解決
 * 4. approval_records に pending で INSERT
 * 5. 通知送信（アプリ内 + Teams※モック）
 */
export async function submitApplication(applicationId: string): Promise<WorkflowSubmitResult> {
  const supabase = createAdminClient()

  // Get the application
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*)')
    .eq('id', applicationId)
    .single()

  if (appError || !application) {
    return { success: false, applicationId, applicationNumber: '', error: 'Application not found' }
  }

  // Get route steps
  const { data: steps } = await supabase
    .from('approval_route_steps')
    .select('*')
    .eq('route_template_id', application.route_template_id)
    .order('step_order')

  if (!steps?.length) {
    return { success: false, applicationId, applicationNumber: application.application_number, error: 'No approval route steps' }
  }

  // Get applicant's primary department
  const { data: assignment } = await supabase
    .from('employee_assignments')
    .select('department_id')
    .eq('employee_id', application.applicant_id)
    .eq('is_primary', true)
    .eq('is_active', true)
    .single()

  if (!assignment) {
    return { success: false, applicationId, applicationNumber: application.application_number, error: 'Applicant has no department' }
  }

  // Resolve first approver
  const firstStep = steps[0]
  const approver = await resolveApprover(firstStep, application.applicant_id, assignment.department_id)

  if (!approver) {
    return { success: false, applicationId, applicationNumber: application.application_number, error: `Cannot resolve approver for step: ${firstStep.name}` }
  }

  // Update application status
  await supabase
    .from('applications')
    .update({
      status: 'in_approval',
      current_step: 1,
      total_steps: steps.length,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  // Create approval record
  await supabase
    .from('approval_records')
    .insert({
      application_id: applicationId,
      step_order: 1,
      step_name: firstStep.name,
      approver_id: approver.employeeId,
      is_proxy: approver.isProxy,
      proxy_for_id: approver.proxyForId || null,
      action: 'pending',
    })

  // Send notification
  await sendWorkflowNotification({
    recipientId: approver.employeeId,
    applicationId,
    type: 'approval_request',
    title: `承認依頼: ${application.title}`,
    body: `${(application.applicant as { name: string }).name}さんから「${application.title}」の承認依頼があります。`,
    actionUrl: `/applications/${applicationId}`,
  })

  return {
    success: true,
    applicationId,
    applicationNumber: application.application_number,
    firstApprover: approver,
  }
}

/**
 * 承認時:
 * 1. approval_records を approved に更新
 * 2. current_step < total_steps なら:
 *    - 次のステップの承認者を解決
 *    - approval_records に pending で INSERT
 *    - 通知送信
 *    - applications の current_step を +1
 * 3. current_step == total_steps なら:
 *    - applications の status を approved に
 *    - 申請者に完了通知
 */
export async function approveApplication(
  applicationId: string,
  approverId: string,
  comment?: string
): Promise<WorkflowApproveResult> {
  const supabase = createAdminClient()

  // Get the application
  const { data: application } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*)')
    .eq('id', applicationId)
    .single()

  if (!application) {
    return { success: false, isCompleted: false, error: 'Application not found' }
  }

  // Update current approval record
  await supabase
    .from('approval_records')
    .update({
      action: 'approved',
      comment: comment || null,
      acted_at: new Date().toISOString(),
    })
    .eq('application_id', applicationId)
    .eq('step_order', application.current_step)
    .eq('approver_id', approverId)

  const isLastStep = application.current_step >= application.total_steps

  if (isLastStep) {
    // Final approval
    await supabase
      .from('applications')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    // Notify applicant
    await sendWorkflowNotification({
      recipientId: application.applicant_id,
      applicationId,
      type: 'approved',
      title: `決裁完了: ${application.title}`,
      body: `「${application.title}」が決裁されました。`,
      actionUrl: `/applications/${applicationId}`,
    })

    return { success: true, isCompleted: true }
  }

  // Move to next step
  const nextStepOrder = application.current_step + 1

  const { data: nextStep } = await supabase
    .from('approval_route_steps')
    .select('*')
    .eq('route_template_id', application.route_template_id)
    .eq('step_order', nextStepOrder)
    .single()

  if (!nextStep) {
    return { success: false, isCompleted: false, error: 'Next step not found' }
  }

  // Get applicant's department
  const { data: assignment } = await supabase
    .from('employee_assignments')
    .select('department_id')
    .eq('employee_id', application.applicant_id)
    .eq('is_primary', true)
    .eq('is_active', true)
    .single()

  if (!assignment) {
    return { success: false, isCompleted: false, error: 'Applicant department not found' }
  }

  const nextApprover = await resolveApprover(nextStep, application.applicant_id, assignment.department_id)

  if (!nextApprover) {
    return { success: false, isCompleted: false, error: `Cannot resolve approver for step: ${nextStep.name}` }
  }

  // Update application
  await supabase
    .from('applications')
    .update({
      current_step: nextStepOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  // Create next approval record
  await supabase
    .from('approval_records')
    .insert({
      application_id: applicationId,
      step_order: nextStepOrder,
      step_name: nextStep.name,
      approver_id: nextApprover.employeeId,
      is_proxy: nextApprover.isProxy,
      proxy_for_id: nextApprover.proxyForId || null,
      action: 'pending',
    })

  // Send notification
  await sendWorkflowNotification({
    recipientId: nextApprover.employeeId,
    applicationId,
    type: 'approval_request',
    title: `承認依頼: ${application.title}`,
    body: `「${application.title}」の承認をお願いします（ステップ ${nextStepOrder}/${application.total_steps}）`,
    actionUrl: `/applications/${applicationId}`,
  })

  return {
    success: true,
    isCompleted: false,
    nextStep: {
      stepOrder: nextStepOrder,
      stepName: nextStep.name,
      approver: nextApprover,
    },
  }
}

/**
 * 差戻し時:
 * 1. approval_records を rejected に更新
 * 2. applications の status を rejected に
 * 3. 申請者に差戻し通知
 */
export async function rejectApplication(
  applicationId: string,
  approverId: string,
  comment: string
): Promise<WorkflowRejectResult> {
  const supabase = createAdminClient()

  const { data: application } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*)')
    .eq('id', applicationId)
    .single()

  if (!application) {
    return { success: false, error: 'Application not found' }
  }

  // Update approval record
  await supabase
    .from('approval_records')
    .update({
      action: 'rejected',
      comment,
      acted_at: new Date().toISOString(),
    })
    .eq('application_id', applicationId)
    .eq('step_order', application.current_step)
    .eq('approver_id', approverId)

  // Update application status
  await supabase
    .from('applications')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  // Notify applicant
  await sendWorkflowNotification({
    recipientId: application.applicant_id,
    applicationId,
    type: 'rejected',
    title: `差戻し: ${application.title}`,
    body: `「${application.title}」が差し戻されました。コメント: ${comment}`,
    actionUrl: `/applications/${applicationId}`,
  })

  return { success: true }
}
