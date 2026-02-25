'use client'

import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils/format'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  value: number
}

export function FormulaField({ field, value }: Props) {
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      <div className="px-3 py-2 bg-blue-50 rounded-md border border-blue-200 text-sm text-right font-medium">
        {formatCurrency(value || 0)}
      </div>
    </div>
  )
}
