type NotificationType = 'approval_request' | 'approved' | 'rejected' | 'reminder' | 'withdrawn'

interface CardContext {
  type: NotificationType
  title: string
  body: string
  actionUrl: string
  applicationNumber?: string
  applicantName?: string
  documentTypeName?: string
  currentStep?: number
  totalSteps?: number
  /**
   * Phase 1.2: Teams Adaptive Card で承認完結。
   *
   * When provided AND `ctx.type === 'approval_request'`, render inline
   * `Action.Execute` buttons that let the approver act without leaving Teams.
   * Power Automate intercepts the action and POSTs to /api/teams/action.
   *
   * Set to null/undefined to fall back to the legacy "詳細を見る" link-only card.
   */
  approverActions?: {
    applicationId: string
    approverId: string
  }
}

const TYPE_LABELS: Record<NotificationType, string> = {
  approval_request: '📋 承認依頼',
  approved: '✅ 決裁完了',
  rejected: '🔙 差戻し',
  reminder: '⏰ リマインド',
  withdrawn: '❌ 取下げ',
}

const TYPE_COLORS: Record<NotificationType, string> = {
  approval_request: 'attention',
  approved: 'good',
  rejected: 'attention',
  reminder: 'accent',
  withdrawn: 'default',
}

export function buildAdaptiveCard(ctx: CardContext) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tsukamoto-workflow.vercel.app'
  const fullUrl = `${baseUrl}${ctx.actionUrl}`

  const facts: { title: string; value: string }[] = []
  if (ctx.applicationNumber) facts.push({ title: '申請番号', value: ctx.applicationNumber })
  if (ctx.applicantName) facts.push({ title: '申請者', value: ctx.applicantName })
  if (ctx.documentTypeName) facts.push({ title: '書類種別', value: ctx.documentTypeName })
  if (ctx.currentStep && ctx.totalSteps) {
    facts.push({ title: '承認ステップ', value: `${ctx.currentStep} / ${ctx.totalSteps}` })
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: TYPE_LABELS[ctx.type] || ctx.type,
        weight: 'bolder',
        size: 'medium',
        color: TYPE_COLORS[ctx.type] || 'default',
      },
      {
        type: 'TextBlock',
        text: ctx.title,
        weight: 'bolder',
        size: 'large',
        wrap: true,
        spacing: 'small',
      },
      {
        type: 'TextBlock',
        text: ctx.body,
        wrap: true,
        spacing: 'small',
      },
      ...(facts.length > 0
        ? [{ type: 'FactSet' as const, facts, spacing: 'medium' as const }]
        : []),
      {
        type: 'TextBlock',
        text: `[詳細を見る →](${fullUrl})`,
        wrap: true,
        spacing: 'medium',
        color: 'accent',
      },
    ],
    actions: buildActions(ctx, fullUrl),
  }
}

function buildActions(ctx: CardContext, fullUrl: string) {
  const openUrl = { type: 'Action.OpenUrl' as const, title: '詳細を見る', url: fullUrl }

  // Only attach approve/reject buttons for approval requests with an approver context.
  if (ctx.type !== 'approval_request' || !ctx.approverActions) {
    return [openUrl]
  }

  const { applicationId, approverId } = ctx.approverActions

  // Adaptive Card 1.5 Action.Execute — Power Automate "When a card action is
  // executed" trigger picks this up and forwards to /api/teams/action.
  return [
    {
      type: 'Action.Execute' as const,
      title: '✅ 承認',
      style: 'positive' as const,
      verb: 'approve',
      data: { verb: 'approve', applicationId, approverId },
    },
    {
      type: 'Action.ShowCard' as const,
      title: '🔙 差戻し',
      card: {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
          {
            type: 'Input.Text',
            id: 'comment',
            label: '差戻しコメント',
            placeholder: '差戻し理由を入力してください',
            isMultiline: true,
            isRequired: true,
            errorMessage: 'コメントは必須です',
          },
        ],
        actions: [
          {
            type: 'Action.Execute',
            title: '差戻しを確定',
            style: 'destructive',
            verb: 'reject',
            data: { verb: 'reject', applicationId, approverId },
          },
        ],
      },
    },
    openUrl,
  ]
}
