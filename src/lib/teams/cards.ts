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
    actions: [
      {
        type: 'Action.OpenUrl',
        title: '詳細を見る',
        url: fullUrl,
      },
    ],
  }
}
