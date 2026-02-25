'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function SelectField({ field, value, onChange, readOnly }: Props) {
  if (readOnly) {
    const option = field.options?.find(o => o.value === value)
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <div className="px-3 py-2 bg-gray-50 rounded-md border text-sm">
          {option?.label || value || '-'}
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
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="選択してください" />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
