import { NextRequest, NextResponse } from 'next/server'
import { approveApplication, rejectApplication } from '@/lib/workflow/engine'
import { writeAuditLog } from '@/lib/audit/logger'

/**
 * POST /api/teams/action — Teams Adaptive Card action callback.
 *
 * Flow (Phase 1.2):
 *   1. Approver clicks ✅ 承認 or 🔙 差戻し button inside the Adaptive Card.
 *   2. Microsoft Teams fires an `adaptiveCard/action` invoke to a registered bot
 *      or to a Power Automate flow (no-bot path).
 *   3. Power Automate forwards the payload to this endpoint, including the
 *      shared-secret header for HMAC-free verification.
 *   4. This endpoint executes the workflow operation and returns the next-card
 *      payload back so the user sees an updated card without leaving Teams.
 *
 * Power Automate template: see docs/power-automate-teams-action.md
 */

interface TeamsActionPayload {
  verb: 'approve' | 'reject'
  applicationId: string
  approverId: string
  comment?: string
}

export async function POST(req: NextRequest) {
  // ── Shared-secret check ──────────────────────────────────────────────────
  // The Power Automate flow injects this header from a secret variable. We do
  // NOT trust anything from the body until this check passes. Keep the secret
  // out of source — set TEAMS_ACTION_SECRET in Vercel env.
  const expected = process.env.TEAMS_ACTION_SECRET
  if (!expected) {
    // Misconfiguration: no secret set. Refuse to process to avoid an open
    // endpoint that anyone can hit and approve applications with.
    return NextResponse.json(
      { error: 'TEAMS_ACTION_SECRET is not configured' },
      { status: 503 },
    )
  }
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse + validate payload ─────────────────────────────────────────────
  let payload: TeamsActionPayload
  try {
    payload = (await req.json()) as TeamsActionPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { verb, applicationId, approverId, comment } = payload
  if (!verb || !applicationId || !approverId) {
    return NextResponse.json(
      { error: 'verb, applicationId, approverId are required' },
      { status: 400 },
    )
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────
  await writeAuditLog({
    actorId: approverId,
    action: verb === 'approve' ? 'application.approve' : 'application.reject',
    targetType: 'application',
    targetId: applicationId,
    metadata: { source: 'teams_adaptive_card', verb, comment: comment ?? null },
  })

  if (verb === 'approve') {
    const result = await approveApplication(applicationId, approverId, comment)
    return NextResponse.json({
      ok: result.success,
      isCompleted: result.isCompleted,
      waitingForOthers: result.waitingForOthers ?? false,
      message: result.success
        ? result.isCompleted ? '✅ 決裁完了しました' : '✅ 承認しました。次の承認者に通知を送信します。'
        : result.error || '承認処理に失敗しました',
    })
  }

  if (verb === 'reject') {
    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { ok: false, message: '差戻しコメントは必須です' },
        { status: 400 },
      )
    }
    const result = await rejectApplication(applicationId, approverId, comment)
    return NextResponse.json({
      ok: result.success,
      message: result.success
        ? '🔙 差戻しました。申請者に通知を送信します。'
        : result.error || '差戻し処理に失敗しました',
    })
  }

  return NextResponse.json({ error: `Unknown verb: ${verb}` }, { status: 400 })
}
