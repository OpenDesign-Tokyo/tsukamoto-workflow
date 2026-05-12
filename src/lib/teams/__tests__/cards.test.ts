import { describe, it, expect } from 'vitest'
import { buildAdaptiveCard } from '../cards'

describe('buildAdaptiveCard', () => {
  it('approval_request without approverActions: link-only fallback', () => {
    const card = buildAdaptiveCard({
      type: 'approval_request',
      title: 'テスト申請',
      body: '承認をお願いします',
      actionUrl: '/applications/abc',
    })
    expect(card.actions).toHaveLength(1)
    expect(card.actions[0]).toMatchObject({ type: 'Action.OpenUrl', title: '詳細を見る' })
  })

  it('approval_request with approverActions: renders approve / reject buttons', () => {
    const card = buildAdaptiveCard({
      type: 'approval_request',
      title: 'テスト申請',
      body: '承認をお願いします',
      actionUrl: '/applications/abc',
      approverActions: { applicationId: 'app-1', approverId: 'emp-1' },
    })
    expect(card.actions).toHaveLength(3)

    const approve = card.actions[0] as { type: string; verb: string; data: { applicationId: string; approverId: string } }
    expect(approve.type).toBe('Action.Execute')
    expect(approve.verb).toBe('approve')
    expect(approve.data).toEqual({ verb: 'approve', applicationId: 'app-1', approverId: 'emp-1' })

    const reject = card.actions[1] as { type: string; title: string; card: { actions: Array<{ verb: string }> } }
    expect(reject.type).toBe('Action.ShowCard')
    expect(reject.title).toBe('🔙 差戻し')
    expect(reject.card.actions[0].verb).toBe('reject')

    const open = card.actions[2] as { type: string }
    expect(open.type).toBe('Action.OpenUrl')
  })

  it('approved type: no action buttons even with approverActions', () => {
    const card = buildAdaptiveCard({
      type: 'approved',
      title: '決裁完了',
      body: '完了しました',
      actionUrl: '/applications/abc',
      approverActions: { applicationId: 'app-1', approverId: 'emp-1' },
    })
    expect(card.actions).toHaveLength(1)
    expect(card.actions[0]).toMatchObject({ type: 'Action.OpenUrl' })
  })

  it('reject card has required comment input', () => {
    const card = buildAdaptiveCard({
      type: 'approval_request',
      title: 'テスト',
      body: '',
      actionUrl: '/x',
      approverActions: { applicationId: 'app-1', approverId: 'emp-1' },
    })
    const showCard = card.actions[1] as { card: { body: Array<{ id?: string; isRequired?: boolean }> } }
    const commentInput = showCard.card.body.find(b => b.id === 'comment')
    expect(commentInput).toBeDefined()
    expect(commentInput?.isRequired).toBe(true)
  })
})
