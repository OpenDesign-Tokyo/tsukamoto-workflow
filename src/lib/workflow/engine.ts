import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApprover, resolveApprovers } from './resolver'
import { sendWorkflowNotification } from './notifications'
import { archiveApprovedApplication } from './archive'
import { writeAuditLog } from '@/lib/audit/logger'
import type { WorkflowSubmitResult, WorkflowApproveResult, WorkflowRejectResult, ResolvedApprover } from '@/lib/types/workflow'
import type { ApprovalRouteStep } from '@/lib/types/database'

type Supabase = ReturnType<typeof createAdminClient>

// Hidden actor used when an unexpected exception happens — the actor is unknown
// from the engine level, so we record a sentinel value the audit reader can filter on.
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return JSON.stringify(e)
}

/**
 * Helper: activate a step by creating approval_records and sending notifications.
 * Handles single / any / all approval types.
 * Returns the list of approvers assigned to this step, or null if no approver found.
 */
async function activateStep(
  supabase: Supabase,
  applicationId: string,
  step: ApprovalRouteStep,
  applicantId: string,
  departmentId: string,
  appTitle: string,
  appNumber: string,
  applicantName: string,
  documentTypeName: string | undefined,
  totalSteps: number,
  selectedApproverIds?: string[],
): Promise<ResolvedApprover[] | null> {
  const approvalType = step.approval_type || 'single'

  // Resolve candidates
  let approvers: ResolvedApprover[]
  if (approvalType === 'single') {
    // For single: use first candidate (or the one selected by applicant)
    if (selectedApproverIds?.length) {
      // Get details for the selected approver
      const allCandidates = await resolveApprovers(step, applicantId, departmentId)
      const selected = allCandidates.find(a => selectedApproverIds.includes(a.employeeId))
      approvers = selected ? [selected] : allCandidates.slice(0, 1)
    } else {
      const single = await resolveApprover(step, applicantId, departmentId)
      approvers = single ? [single] : []
    }
  } else {
    // For any/all: get all candidates
    const allCandidates = await resolveApprovers(step, applicantId, departmentId)
    if (selectedApproverIds?.length) {
      // Filter to selected approvers only
      approvers = allCandidates.filter(a => selectedApproverIds.includes(a.employeeId))
      if (approvers.length === 0) approvers = allCandidates
    } else {
      approvers = allCandidates
    }
  }

  if (approvers.length === 0) return null

  // Create approval records for all assigned approvers
  const records = approvers.map(a => ({
    application_id: applicationId,
    step_order: step.step_order,
    step_name: step.name,
    approver_id: a.employeeId,
    is_proxy: a.isProxy,
    proxy_for_id: a.proxyForId || null,
    action: 'pending' as const,
  }))
  await supabase.from('approval_records').insert(records)

  // Send notifications to all approvers
  for (const a of approvers) {
    await sendWorkflowNotification({
      recipientId: a.employeeId,
      applicationId,
      type: 'approval_request',
      title: `承認依頼: ${appTitle}`,
      body: `${applicantName}さんから「${appTitle}」の承認依頼があります。`,
      actionUrl: `/applications/${applicationId}`,
      applicationNumber: appNumber,
      applicantName,
      documentTypeName,
      currentStep: step.step_order,
      totalSteps,
    })
  }

  return approvers
}

/**
 * Helper: mark application as approved (final).
 */
async function finalApprove(
  supabase: Supabase,
  applicationId: string,
  applicantId: string,
  appTitle: string,
  appNumber: string,
  applicantName: string,
  documentTypeName: string | undefined,
  totalSteps: number,
) {
  await supabase
    .from('applications')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  await sendWorkflowNotification({
    recipientId: applicantId,
    applicationId,
    type: 'approved',
    title: `決裁完了: ${appTitle}`,
    body: `「${appTitle}」が決裁されました。`,
    actionUrl: `/applications/${applicationId}`,
    applicationNumber: appNumber,
    applicantName,
    documentTypeName,
    currentStep: totalSteps,
    totalSteps,
  })

  // SharePoint 自動アーカイブを fire-and-forget で起動する。
  // 失敗してもエンジン側のレスポンスは妨げない（archive.ts 内で完結）。
  archiveApprovedApplication(applicationId).catch(err => {
    console.error(`[engine.finalApprove] archive failed for ${applicationId}:`, err)
  })
}

/**
 * Helper: advance to the next resolvable step after current step.
 * Skips steps where no approver can be found.
 * Returns the result for the caller.
 */
async function advanceToNextStep(
  supabase: Supabase,
  applicationId: string,
  application: Record<string, unknown>,
  applicantName: string,
  documentTypeName: string | undefined,
  selectedNextApproverIds?: string[],
): Promise<WorkflowApproveResult> {
  const routeTemplateId = application.route_template_id as string
  const applicantId = application.applicant_id as string
  const appTitle = application.title as string
  const appNumber = application.application_number as string
  const currentStep = application.current_step as number
  const totalSteps = application.total_steps as number

  const isLastStep = currentStep >= totalSteps
  if (isLastStep) {
    await finalApprove(supabase, applicationId, applicantId, appTitle, appNumber, applicantName, documentTypeName, totalSteps)
    return { success: true, isCompleted: true }
  }

  // Get remaining steps
  const { data: remainingSteps } = await supabase
    .from('approval_route_steps')
    .select('*')
    .eq('route_template_id', routeTemplateId)
    .gt('step_order', currentStep)
    .order('step_order')

  if (!remainingSteps?.length) {
    await finalApprove(supabase, applicationId, applicantId, appTitle, appNumber, applicantName, documentTypeName, totalSteps)
    return { success: true, isCompleted: true }
  }

  // Get applicant's department
  const { data: assignment } = await supabase
    .from('employee_assignments')
    .select('department_id')
    .eq('employee_id', applicantId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!assignment) {
    return { success: false, isCompleted: false, error: 'Applicant department not found' }
  }

  // Find next resolvable step
  for (const step of remainingSteps) {
    // For the immediate next step, use selectedNextApproverIds if provided
    const selIds = step === remainingSteps[0] ? selectedNextApproverIds : undefined
    const approvers = await activateStep(
      supabase, applicationId, step, applicantId, assignment.department_id,
      appTitle, appNumber, applicantName, documentTypeName, totalSteps,
      selIds,
    )

    if (approvers && approvers.length > 0) {
      // Update application current_step
      await supabase
        .from('applications')
        .update({ current_step: step.step_order, updated_at: new Date().toISOString() })
        .eq('id', applicationId)

      return {
        success: true,
        isCompleted: false,
        nextStep: {
          stepOrder: step.step_order,
          stepName: step.name,
          approver: approvers[0],
        },
      }
    }

    // Skip this step: no approver found
    await supabase
      .from('approval_records')
      .insert({
        application_id: applicationId,
        step_order: step.step_order,
        step_name: step.name,
        approver_id: applicantId,
        is_proxy: false,
        action: 'skipped',
        comment: '該当承認者不在のためスキップ',
        acted_at: new Date().toISOString(),
      })
  }

  // All remaining steps unresolvable — treat as final
  await finalApprove(supabase, applicationId, applicantId, appTitle, appNumber, applicantName, documentTypeName, totalSteps)
  return { success: true, isCompleted: true }
}

/**
 * 申請送信時:
 * 1. applications を in_approval に更新
 * 2. 承認ルートテンプレートから全ステップを取得
 * 3. 最初のステップの承認者を resolver で解決（single/any/all対応）
 * 4. approval_records に pending で INSERT
 * 5. 通知送信
 */
async function _submitApplicationCore(
  applicationId: string,
  selectedApprovers?: Record<string, string[]>,
): Promise<WorkflowSubmitResult> {
  const supabase = createAdminClient()

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*), document_type:document_types(name)')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !application) {
    return { success: false, applicationId, applicationNumber: '', error: 'Application not found' }
  }

  const applicant = application.applicant as { name: string; is_admin: boolean }
  const applicantName = applicant.name
  const documentTypeName = (application.document_type as { name: string } | null)?.name

  // Store selected_approvers if provided
  if (selectedApprovers && Object.keys(selectedApprovers).length > 0) {
    await supabase
      .from('applications')
      .update({ selected_approvers: selectedApprovers })
      .eq('id', applicationId)
  }

  // Admin self-approval
  if (applicant.is_admin) {
    await supabase
      .from('applications')
      .update({
        status: 'in_approval',
        current_step: 1,
        total_steps: 1,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    await supabase
      .from('approval_records')
      .insert({
        application_id: applicationId,
        step_order: 1,
        step_name: '管理者承認',
        approver_id: application.applicant_id,
        is_proxy: false,
        action: 'pending',
      })

    await sendWorkflowNotification({
      recipientId: application.applicant_id,
      applicationId,
      type: 'approval_request',
      title: `承認依頼（自己承認）: ${application.title}`,
      body: `「${application.title}」の管理者承認をお願いします。`,
      actionUrl: `/applications/${applicationId}`,
      applicationNumber: application.application_number,
      applicantName,
      documentTypeName,
      currentStep: 1,
      totalSteps: 1,
    })

    return {
      success: true,
      applicationId,
      applicationNumber: application.application_number,
      firstApprover: {
        employeeId: application.applicant_id,
        employeeName: applicantName,
        positionName: '管理者',
        departmentName: '',
        isProxy: false,
      },
    }
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
    .maybeSingle()

  if (!assignment) {
    return { success: false, applicationId, applicationNumber: application.application_number, error: 'Applicant has no department' }
  }

  // Find first resolvable step
  let firstApproverResult: ResolvedApprover[] | null = null
  let activeStep: typeof steps[0] | null = null

  for (const step of steps) {
    const selIds = selectedApprovers?.[String(step.step_order)]
    const result = await activateStep(
      supabase, applicationId, step, application.applicant_id, assignment.department_id,
      application.title, application.application_number, applicantName, documentTypeName,
      steps.length, selIds,
    )

    if (result && result.length > 0) {
      firstApproverResult = result
      activeStep = step
      break
    }

    // Skip this step
    await supabase
      .from('approval_records')
      .insert({
        application_id: applicationId,
        step_order: step.step_order,
        step_name: step.name,
        approver_id: application.applicant_id,
        is_proxy: false,
        action: 'skipped',
        comment: '該当承認者不在のためスキップ',
        acted_at: new Date().toISOString(),
      })
  }

  if (!activeStep || !firstApproverResult) {
    return { success: false, applicationId, applicationNumber: application.application_number, error: 'No resolvable approver found in any step' }
  }

  // Update application status
  await supabase
    .from('applications')
    .update({
      status: 'in_approval',
      current_step: activeStep.step_order,
      total_steps: steps.length,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  return {
    success: true,
    applicationId,
    applicationNumber: application.application_number,
    firstApprover: firstApproverResult[0],
  }
}

/**
 * 承認時（single/any/all対応）:
 * - single: 次ステップへ進む
 * - any: 1人承認 → 残りpendingをskipped → 次ステップへ
 * - all: 全員承認済みか確認 → 未完了なら待機、完了なら次ステップへ
 */
async function _approveApplicationCore(
  applicationId: string,
  approverId: string,
  comment?: string,
  selectedNextApprovers?: string[],
): Promise<WorkflowApproveResult> {
  const supabase = createAdminClient()

  const { data: application } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*), document_type:document_types(name)')
    .eq('id', applicationId)
    .maybeSingle()

  if (!application) {
    return { success: false, isCompleted: false, error: 'Application not found' }
  }

  const applicantName = (application.applicant as { name: string }).name
  const documentTypeName = (application.document_type as { name: string } | null)?.name

  // Update this approver's record
  const updateData: Record<string, unknown> = {
    action: 'approved',
    comment: comment || null,
    acted_at: new Date().toISOString(),
  }
  if (selectedNextApprovers?.length) {
    updateData.selected_next_approvers = selectedNextApprovers
  }
  await supabase
    .from('approval_records')
    .update(updateData)
    .eq('application_id', applicationId)
    .eq('step_order', application.current_step)
    .eq('approver_id', approverId)
    .eq('action', 'pending')

  // Get the current step definition to check approval_type
  const { data: currentStepDef } = await supabase
    .from('approval_route_steps')
    .select('*')
    .eq('route_template_id', application.route_template_id)
    .eq('step_order', application.current_step)
    .maybeSingle()

  const approvalType = currentStepDef?.approval_type || 'single'

  if (approvalType === 'all') {
    // Check if all approvers for this step have approved
    const { data: stepRecords } = await supabase
      .from('approval_records')
      .select('action')
      .eq('application_id', applicationId)
      .eq('step_order', application.current_step)

    const pending = stepRecords?.filter(r => r.action === 'pending') || []
    if (pending.length > 0) {
      // Still waiting for other approvers
      return { success: true, isCompleted: false, waitingForOthers: true }
    }
    // All done — advance
  }

  if (approvalType === 'any') {
    // Skip remaining pending records for this step
    await supabase
      .from('approval_records')
      .update({
        action: 'skipped',
        comment: '他の承認者が承認済み',
        acted_at: new Date().toISOString(),
      })
      .eq('application_id', applicationId)
      .eq('step_order', application.current_step)
      .eq('action', 'pending')
  }

  // Advance to next step (or finalize)
  return advanceToNextStep(
    supabase, applicationId, application, applicantName, documentTypeName,
    selectedNextApprovers,
  )
}

/**
 * 差戻し時（multi-approver対応）:
 * 1人が差戻し → 同ステップの他のpending recordsをskipped → 申請却下
 */
async function _rejectApplicationCore(
  applicationId: string,
  approverId: string,
  comment: string
): Promise<WorkflowRejectResult> {
  const supabase = createAdminClient()

  const { data: application } = await supabase
    .from('applications')
    .select('*, applicant:employees!applicant_id(*), document_type:document_types(name)')
    .eq('id', applicationId)
    .maybeSingle()

  if (!application) {
    return { success: false, error: 'Application not found' }
  }

  const applicantName = (application.applicant as { name: string }).name
  const documentTypeName = (application.document_type as { name: string } | null)?.name

  // Update this approver's record
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
    .eq('action', 'pending')

  // Skip remaining pending records for this step (multi-approver)
  await supabase
    .from('approval_records')
    .update({
      action: 'skipped',
      comment: '他の承認者が差戻し',
      acted_at: new Date().toISOString(),
    })
    .eq('application_id', applicationId)
    .eq('step_order', application.current_step)
    .eq('action', 'pending')

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
    applicationNumber: application.application_number,
    applicantName,
    documentTypeName,
    currentStep: application.current_step,
    totalSteps: application.total_steps,
  })

  return { success: true }
}

// ───────────────────── Public wrappers with error handling ─────────────────────
// Wrap each workflow operation in try/catch. On unexpected failure we record an
// audit log entry and return a structured error result instead of letting the
// exception bubble up to the API route (which would result in a generic 500).
//
// NOTE: This is a defensive net, not transactional atomicity. For true atomicity
// (Phase 0.1 in IMPLEMENTATION_ROADMAP.md) the operations need to be moved into
// Postgres RPC functions where the writes can share a single transaction.

export async function submitApplication(
  applicationId: string,
  selectedApprovers?: Record<string, string[]>,
): Promise<WorkflowSubmitResult> {
  try {
    return await _submitApplicationCore(applicationId, selectedApprovers)
  } catch (e) {
    const message = errorMessage(e)
    console.error('[workflow.submit] failed:', message, e)
    await writeAuditLog({
      actorId: SYSTEM_ACTOR,
      action: 'application.submit',
      targetType: 'application',
      targetId: applicationId,
      metadata: { error: message, phase: 'engine.submitApplication' },
    })
    return { success: false, applicationId, applicationNumber: '', error: message }
  }
}

export async function approveApplication(
  applicationId: string,
  approverId: string,
  comment?: string,
  selectedNextApprovers?: string[],
): Promise<WorkflowApproveResult> {
  try {
    return await _approveApplicationCore(applicationId, approverId, comment, selectedNextApprovers)
  } catch (e) {
    const message = errorMessage(e)
    console.error('[workflow.approve] failed:', message, e)
    await writeAuditLog({
      actorId: approverId || SYSTEM_ACTOR,
      action: 'application.approve',
      targetType: 'application',
      targetId: applicationId,
      metadata: { error: message, phase: 'engine.approveApplication' },
    })
    return { success: false, isCompleted: false, error: message }
  }
}

export async function rejectApplication(
  applicationId: string,
  approverId: string,
  comment: string,
): Promise<WorkflowRejectResult> {
  try {
    return await _rejectApplicationCore(applicationId, approverId, comment)
  } catch (e) {
    const message = errorMessage(e)
    console.error('[workflow.reject] failed:', message, e)
    await writeAuditLog({
      actorId: approverId || SYSTEM_ACTOR,
      action: 'application.reject',
      targetType: 'application',
      targetId: applicationId,
      metadata: { error: message, phase: 'engine.rejectApplication' },
    })
    return { success: false, error: message }
  }
}
