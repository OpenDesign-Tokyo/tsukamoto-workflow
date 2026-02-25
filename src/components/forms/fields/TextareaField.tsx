'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function TextareaField({ field, value, onChange, readOnly }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        id={field.id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={field.rows || 3}
        readOnly={readOnly}
        className={readOnly ? 'bg-gray-50' : ''}
      />
    </div>
  )
}
