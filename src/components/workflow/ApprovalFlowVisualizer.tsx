'use client'

/**
 * 承認フローの水平ステップ可視化コンポーネント。
 *
 * `/admin/routes` で使われていたインライン表示を抽出し、3 つの状況で再利用:
 *
 *   1. 編集モード (admin/routes): 承認者・状態は無し、役職ラベルのみ
 *   2. 進行モード (application detail): 各ステップに承認者名 + 状態色 + 「あなたはここ」
 *   3. 承認モード (approval actions): 上記 + 次ステップ（動的選択待ち）の視覚化
 *
 * 状態カラー:
 *   - 完了 (approved): 緑チェック
 *   - 進行中 (current step, pending): 青パルス + 「▼ いまここ」
 *   - 未着手 (future): グレー
 *   - 動的選択待ち (allow_dynamic_selection で未決定): 破線 + "?"
 *   - 差戻し (rejected): 赤
 *   - スキップ (skipped): 薄いグレー
 */

import { Check, Clock, X, SkipForward, HelpCircle, ChevronRight, User as UserIcon, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FlowStepData {
  stepOrder: number
  name: string
  /** ステップに紐付く役職名（編集モードで表示） */
  positionName?: string | null
  /** 承認者の決定方式（位置・役職・社員指定など） */
  assigneeType?: string | null
  /** 動的承認者選択フラグ (true なら未確定で表示) */
  allowDynamicSelection?: boolean
  /** 承認タイプ ('single' | 'any' | 'all') */
  approvalType?: 'single' | 'any' | 'all' | string | null
  /** ステップに割り当てられた承認者（実行モードで使用） */
  approvers?: Array<{
    name: string
    action: 'pending' | 'approved' | 'rejected' | 'skipped'
    actedAt?: string | null
    isProxy?: boolean
    proxyForName?: string | null
  }>
}

export interface FlowObserver {
  id: string
  name: string
  positionName?: string | null
  departmentName?: string | null
}

interface Props {
  steps: FlowStepData[]
  /** 1-based。指定されたステップを「いまここ」としてハイライト */
  currentStep?: number
  /** 申請ステータス（rejected/withdrawn 等の全体状態を反映） */
  applicationStatus?: 'draft' | 'submitted' | 'in_approval' | 'approved' | 'rejected' | 'withdrawn' | 'archived' | null
  /** 閲覧者（オブザーバー）のリスト */
  observers?: FlowObserver[]
  /** サイズ調整: compact = ダッシュボードカード等 */
  size?: 'normal' | 'compact'
  className?: string
}

const STEP_COLORS = [
  { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-200' },
  { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  { bg: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700',  ring: 'ring-purple-200' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
] as const

type StepState = 'editor' | 'completed' | 'current' | 'future' | 'rejected' | 'skipped' | 'dynamic_pending'

/** Decide overall display state for a step. */
function computeStepState(
  step: FlowStepData,
  currentStep: number | undefined,
  applicationStatus: Props['applicationStatus'],
): StepState {
  const approvers = step.approvers || []

  // Editor mode: no currentStep AND no executed approvers → render with the
  // colorful per-index palette (matches the original /admin/routes look).
  if (currentStep === undefined && approvers.length === 0) {
    return 'editor'
  }

  if (approvers.some(a => a.action === 'rejected')) return 'rejected'

  // For multi-approver steps, "completed" means everyone has acted (approved or skipped).
  if (approvers.length > 0) {
    const allDone = approvers.every(a => a.action === 'approved' || a.action === 'skipped')
    const hasApproved = approvers.some(a => a.action === 'approved')
    if (allDone && hasApproved) return 'completed'
    if (allDone && !hasApproved) return 'skipped'
    if (approvers.some(a => a.action === 'pending')) {
      return currentStep === step.stepOrder ? 'current' : 'future'
    }
  }

  // No approvers assigned yet (future step). If allow_dynamic_selection is set,
  // surface that so the user understands "誰になるか未決定" semantics.
  if (step.allowDynamicSelection && (!currentStep || step.stepOrder > currentStep)) {
    return 'dynamic_pending'
  }

  if (applicationStatus === 'rejected' && currentStep && step.stepOrder > currentStep) return 'future'
  if (currentStep && step.stepOrder === currentStep) return 'current'
  if (currentStep && step.stepOrder < currentStep) return 'completed'
  return 'future'
}

function StepBubble({
  step,
  state,
  idx,
  size,
}: {
  step: FlowStepData
  state: StepState
  idx: number
  size: 'normal' | 'compact'
}) {
  const color = STEP_COLORS[idx % STEP_COLORS.length]
  const sizeCfg = size === 'compact'
    ? { box: 'px-2.5 py-1.5', circle: 'w-6 h-6 text-[10px]', main: 'text-[11px]', sub: 'text-[9px]', gap: 'gap-1.5' }
    : { box: 'px-4 py-2',     circle: 'w-7 h-7 text-xs',    main: 'text-xs',    sub: 'text-[10px]', gap: 'gap-2.5' }

  // ── State-driven visuals ────────────────────────────────────────────────
  let circleClass: string
  let boxClass: string
  let icon: React.ReactNode = (
    <span className="text-white font-bold">{step.stepOrder}</span>
  )
  let nameClass: string = color.text

  switch (state) {
    case 'editor':
      // Per-step rainbow palette — matches the original /admin/routes look
      // before this visualizer existed.
      circleClass = cn(color.bg, 'shadow-sm')
      boxClass = cn(color.light, 'border-transparent')
      nameClass = color.text
      break
    case 'completed':
      circleClass = 'bg-emerald-500'
      boxClass = 'bg-emerald-50 border-emerald-200'
      icon = <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      nameClass = 'text-emerald-700'
      break
    case 'current':
      circleClass = cn(color.bg, 'ring-4', color.ring, 'animate-pulse')
      boxClass = cn(color.light, 'border-2 border-current shadow-sm', color.text.replace('text-', 'border-'))
      break
    case 'rejected':
      circleClass = 'bg-red-500'
      boxClass = 'bg-red-50 border-red-200'
      icon = <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      nameClass = 'text-red-700'
      break
    case 'skipped':
      circleClass = 'bg-gray-300'
      boxClass = 'bg-gray-50 border-gray-200 opacity-60'
      icon = <SkipForward className="w-3 h-3 text-white" />
      nameClass = 'text-gray-500'
      break
    case 'dynamic_pending':
      circleClass = 'bg-amber-100 border-2 border-dashed border-amber-400'
      boxClass = 'bg-amber-50 border-amber-200 border-dashed'
      icon = <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
      nameClass = 'text-amber-700'
      break
    case 'future':
    default:
      circleClass = 'bg-gray-200'
      boxClass = 'bg-gray-50 border-gray-200'
      icon = <span className="text-gray-500 font-bold">{step.stepOrder}</span>
      nameClass = 'text-gray-500'
      break
  }

  // ── Detail line under the step name ──────────────────────────────────────
  const approvers = step.approvers || []
  let detailText: string | null = null
  if (approvers.length === 1) {
    detailText = approvers[0].name
  } else if (approvers.length > 1) {
    const pending = approvers.filter(a => a.action === 'pending').length
    detailText = `${approvers.length}名` + (pending > 0 ? ` (${pending}名承認待ち)` : '')
  } else if (step.positionName) {
    detailText = step.positionName
  }
  if (state === 'dynamic_pending') {
    detailText = step.positionName ? `${step.positionName}（前承認者が指名）` : '前承認者が指名'
  }

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'flex items-center rounded-xl border transition-colors',
          sizeCfg.box,
          sizeCfg.gap,
          boxClass,
        )}
      >
        <div
          className={cn(
            'rounded-full flex items-center justify-center shrink-0 shadow-sm',
            sizeCfg.circle,
            circleClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={cn('font-semibold truncate', sizeCfg.main, nameClass)}>{step.name}</p>
          {detailText && <p className={cn('truncate text-gray-500', sizeCfg.sub)}>{detailText}</p>}
        </div>
        {step.approvalType === 'all' && (approvers.length > 1 || (!approvers.length && state === 'future')) && (
          <span className={cn('px-1 text-[9px] font-semibold rounded bg-white/70 ml-0.5', sizeCfg.sub)}>AND</span>
        )}
        {step.approvalType === 'any' && (approvers.length > 1 || (!approvers.length && state === 'future')) && (
          <span className={cn('px-1 text-[9px] font-semibold rounded bg-white/70 ml-0.5', sizeCfg.sub)}>OR</span>
        )}
      </div>
      {/* "あなたはここ" pointer */}
      {state === 'current' && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-5 text-[10px] font-semibold text-blue-600 whitespace-nowrap">
          ▼ いまここ
        </div>
      )}
    </div>
  )
}

export function ApprovalFlowVisualizer({
  steps,
  currentStep,
  applicationStatus,
  observers,
  size = 'normal',
  className,
}: Props) {
  if (!steps || steps.length === 0) {
    return <p className="text-xs text-gray-400">承認ステップが設定されていません</p>
  }

  // Reserve top space only when the "▼いまここ" marker may render
  const hasCurrent = currentStep !== undefined && currentStep > 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('flex items-center gap-1 overflow-x-auto pb-0.5', hasCurrent && 'pt-5')}>
        {steps.map((step, idx) => {
          const state = computeStepState(step, currentStep, applicationStatus)
          const isLast = idx === steps.length - 1
          return (
            <div key={step.stepOrder} className="flex items-center gap-1 shrink-0">
              <StepBubble step={step} state={state} idx={idx} size={size} />
              {!isLast && (
                <ChevronRight
                  className={cn(
                    'shrink-0',
                    size === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                    state === 'completed' ? 'text-emerald-400' : 'text-gray-300',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {observers && observers.length > 0 && (
        <div className="flex items-start gap-2 px-1">
          <Eye className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-gray-500">閲覧者:</span>
            {observers.map(o => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-700"
              >
                <UserIcon className="w-3 h-3 text-gray-400" />
                {o.name}
                {o.positionName && <span className="text-gray-400">・{o.positionName}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
