'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  value: number | string
  onChange: (value: number | string) => void
  readOnly?: boolean
}

export function NumberField({ field, value, onChange, readOnly }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        id={field.id}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        readOnly={readOnly}
        className={readOnly ? 'bg-gray-50' : ''}
      />
    </div>
  )
}
