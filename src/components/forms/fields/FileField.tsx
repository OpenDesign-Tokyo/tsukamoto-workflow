'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  readOnly?: boolean
}

export function FileField({ field, readOnly }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {readOnly ? (
        <div className="px-3 py-2 bg-gray-50 rounded-md border text-sm text-gray-500">
          添付ファイルなし
        </div>
      ) : (
        <Input id={field.id} type="file" />
      )}
    </div>
  )
}
