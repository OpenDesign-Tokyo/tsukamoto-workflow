'use client'

import { Check, Clock, X, SkipForward, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/format'
import type { ApprovalRecord, Employee } from '@/lib/types/database'

interface Props {
  records: (ApprovalRecord & { approver: Employee })[]
  totalSteps: number
  currentStep: number
}

const ACTION_CONFIG = {
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100', label: '承認待ち' },
  approved: { icon: Check, color: 'text-green-500', bg: 'bg-green-100', label: '承認済み' },
  rejected: { icon: X, color: 'text-red-500', bg: 'bg-red-100', label: '差戻し' },
  skipped: { icon: SkipForward, color: 'text-gray-400', bg: 'bg-gray-100', label: 'スキップ' },
}

export function ApprovalTimeline({ records, totalSteps, currentStep }: Props) {
  // Group records by step_order
  const stepMap = new Map<number, (ApprovalRecord & { approver: Employee })[]>()
  for (const record of records) {
    const existing = stepMap.get(record.step_order) || []
    existing.push(record)
    stepMap.set(record.step_order, existing)
  }

  // Build steps from 1 to totalSteps
  const steps = Array.from({ length: totalSteps }, (_, i) => {
    const stepOrder = i + 1
    const stepRecords = stepMap.get(stepOrder) || []
    return { stepOrder, records: stepRecords }
  })

  return (
    <div className="space-y-0">
      {steps.map(({ stepOrder, records: stepRecords }, idx) => {
        const isLast = idx === steps.length - 1
        const isFuture = stepRecords.length === 0
        const isMultiApprover = stepRecords.length > 1

        // Determine overall step status
        let overallAction: string | null = null
        if (stepRecords.length > 0) {
          const hasRejected = stepRecords.some(r => r.action === 'rejected')
          const allApproved = stepRecords.every(r => r.action === 'approved' || r.action === 'skipped')
          const hasPending = stepRecords.some(r => r.action === 'pending')

          if (hasRejected) overallAction = 'rejected'
          else if (allApproved) overallAction = 'approved'
          else if (hasPending) overallAction = 'pending'
          else overallAction = 'skipped'
        }

        const config = overallAction ? ACTION_CONFIG[overallAction as keyof typeof ACTION_CONFIG] : null

        const stepName = stepRecords[0]?.step_name || `ステップ ${stepOrder}`

        return (
          <div key={stepOrder} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  config ? config.bg : 'bg-gray-100'
                )}
              >
                {isMultiApprover && overallAction === 'pending' ? (
                  <Users className="w-4 h-4 text-amber-500" />
                ) : config ? (
                  <config.icon className={cn('w-4 h-4', config.color)} />
                ) : (
                  <span className="text-xs text-gray-400">{stepOrder}</span>
                )}
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 h-8',
                  overallAction === 'approved' ? 'bg-green-200' : 'bg-gray-200'
                )} />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0 flex-1">
              <p className={cn(
                'text-sm font-medium',
                isFuture ? 'text-gray-400' : 'text-gray-900'
              )}>
                {stepName}
              </p>

              {isMultiApprover ? (
                // Multi-approver display
                <div className="mt-1 space-y-1">
                  {stepRecords
                    .filter(r => !(r.action === 'skipped' && (r.comment === '他の承認者が承認済み' || r.comment === '他の承認者が差戻し')))
                    .map((record) => {
                      const rConfig = ACTION_CONFIG[record.action]
                      return (
                        <div key={record.id} className="flex items-center gap-1.5 text-xs">
                          <rConfig.icon className={cn('w-3 h-3', rConfig.color)} />
                          <span className="text-gray-700">{record.approver?.name}</span>
                          <span className="text-gray-400">- {rConfig.label}</span>
                          {record.acted_at && (
                            <span className="text-gray-400 ml-1">{formatDateTime(record.acted_at)}</span>
                          )}
                        </div>
                      )
                    })}
                  {stepRecords.some(r => r.comment && r.action !== 'skipped') && (
                    <div className="mt-1 space-y-1">
                      {stepRecords
                        .filter(r => r.comment && r.action !== 'skipped')
                        .map(r => (
                          <p key={r.id} className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            {r.approver?.name}: {r.comment}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              ) : stepRecords.length === 1 ? (
                // Single approver display
                <>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stepRecords[0].approver?.name}
                    {config && ` - ${config.label}`}
                  </p>
                  {stepRecords[0].acted_at && (
                    <p className="text-xs text-gray-400">{formatDateTime(stepRecords[0].acted_at)}</p>
                  )}
                  {stepRecords[0].comment && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2">
                      {stepRecords[0].comment}
                    </p>
                  )}
                </>
              ) : (
                // Future step
                <p className="text-xs text-gray-400 mt-0.5">未到達</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
