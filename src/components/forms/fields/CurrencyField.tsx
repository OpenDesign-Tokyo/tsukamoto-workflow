'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils/format'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  value: number | string
  onChange: (value: number | string) => void
  readOnly?: boolean
}

export function CurrencyField({ field, value, onChange, readOnly }: Props) {
  if (readOnly) {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <div className="px-3 py-2 bg-gray-50 rounded-md border text-sm text-right">
          {formatCurrency(typeof value === 'number' ? value : Number(value) || 0)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
        <Input
          id={field.id}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="pl-7 text-right"
        />
      </div>
    </div>
  )
}
