import type { FormSchema, FormField } from '@/lib/types/database'

export interface ValidationError {
  fieldId: string
  message: string
}

export function validateFormData(
  schema: FormSchema,
  formData: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = []

  for (const field of schema.fields) {
    const value = formData[field.id]

    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push({ fieldId: field.id, message: `${field.label}は必須項目です` })
        continue
      }

      if (field.type === 'table') {
        const rows = value as Record<string, unknown>[]
        if (!rows || rows.length === 0) {
          errors.push({ fieldId: field.id, message: `${field.label}には1行以上入力してください` })
        }
      }
    }

    // Table row validation
    if (field.type === 'table' && value) {
      const rows = value as Record<string, unknown>[]
      if (field.minRows && rows.length < field.minRows) {
        errors.push({ fieldId: field.id, message: `${field.label}は${field.minRows}行以上必要です` })
      }
      if (field.maxRows && rows.length > field.maxRows) {
        errors.push({ fieldId: field.id, message: `${field.label}は${field.maxRows}行以下にしてください` })
      }
    }
  }

  return errors
}
