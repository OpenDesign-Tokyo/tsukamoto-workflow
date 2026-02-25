'use client'

import { Check, Clock, X, SkipForward } from 'lucide-react'
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
  // Build steps from 1 to totalSteps
  const steps = Array.from({ length: totalSteps }, (_, i) => {
    const stepOrder = i + 1
    const record = records.find(r => r.step_order === stepOrder)
    return { stepOrder, record }
  })

  return (
    <div className="space-y-0">
      {steps.map(({ stepOrder, record }, idx) => {
        const config = record ? ACTION_CONFIG[record.action] : null
        const isLast = idx === steps.length - 1
        const isFuture = !record

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
                {config ? (
                  <config.icon className={cn('w-4 h-4', config.color)} />
                ) : (
                  <span className="text-xs text-gray-400">{stepOrder}</span>
                )}
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 h-8',
                  record?.action === 'approved' ? 'bg-green-200' : 'bg-gray-200'
                )} />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className={cn(
                'text-sm font-medium',
                isFuture ? 'text-gray-400' : 'text-gray-900'
              )}>
                {record?.step_name || `ステップ ${stepOrder}`}
              </p>
              {record && (
                <>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {record.approver?.name}
                    {config && ` - ${config.label}`}
                  </p>
                  {record.acted_at && (
                    <p className="text-xs text-gray-400">{formatDateTime(record.acted_at)}</p>
                  )}
                  {record.comment && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2">
                      {record.comment}
                    </p>
                  )}
                </>
              )}
              {isFuture && (
                <p className="text-xs text-gray-400 mt-0.5">未到達</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
