'use client'

import { useMemo } from 'react'
import { TextField } from './fields/TextField'
import { NumberField } from './fields/NumberField'
import { DateField } from './fields/DateField'
import { SelectField } from './fields/SelectField'
import { TextareaField } from './fields/TextareaField'
import { CurrencyField } from './fields/CurrencyField'
import { TableField } from './fields/TableField'
import { FormulaField } from './fields/FormulaField'
import { FileField } from './fields/FileField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FormSchema, FormField } from '@/lib/types/database'

interface Props {
  schema: FormSchema
  formData: Record<string, unknown>
  onChange?: (data: Record<string, unknown>) => void
  readOnly?: boolean
  errors?: Record<string, string>
}

function evaluateFormula(formula: string, formData: Record<string, unknown>): number {
  // Handle SUM(items.subtotal) style formulas
  const sumMatch = formula.match(/SUM\((\w+)\.(\w+)\)/)
  if (sumMatch) {
    const [, tableId, colId] = sumMatch
    const rows = formData[tableId] as Record<string, unknown>[] | undefined
    if (!rows) return 0
    return rows.reduce((sum, row) => {
      const val = row[colId]
      return sum + (typeof val === 'number' ? val : 0)
    }, 0)
  }

  // Handle simple arithmetic formulas like "quantity * unit_price"
  try {
    const expr = formula.replace(/[a-z_]\w*/gi, (match) => {
      const val = formData[match]
      return typeof val === 'number' ? String(val) : '0'
    })
    // Only allow digits, operators, parentheses, dots, spaces
    if (!/^[\d+\-*/().  ]+$/.test(expr)) return 0
    return Function(`"use strict"; return (${expr})`)() as number
  } catch {
    return 0
  }
}

export function FormRenderer({ schema, formData, onChange, readOnly = false, errors = {} }: Props) {
  const fieldMap = useMemo(() => {
    const map = new Map<string, FormField>()
    schema.fields.forEach((f) => map.set(f.id, f))
    return map
  }, [schema.fields])

  const handleFieldChange = (fieldId: string, value: unknown) => {
    if (!onChange) return
    onChange({ ...formData, [fieldId]: value })
  }

  const renderField = (fieldId: string) => {
    const field = fieldMap.get(fieldId)
    if (!field) return null

    const value = formData[fieldId]
    const error = errors[fieldId]

    const fieldElement = (() => {
    switch (field.type) {
      case 'text':
        return (
          <TextField
            key={field.id}
            field={field}
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'number':
        return (
          <NumberField
            key={field.id}
            field={field}
            value={value as number | string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'date':
        return (
          <DateField
            key={field.id}
            field={field}
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'select':
        return (
          <SelectField
            key={field.id}
            field={field}
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'textarea':
        return (
          <TextareaField
            key={field.id}
            field={field}
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'currency':
        return (
          <CurrencyField
            key={field.id}
            field={field}
            value={value as number | string}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'table':
        return (
          <TableField
            key={field.id}
            field={field}
            value={(value as Record<string, unknown>[]) || [{}]}
            onChange={(v) => handleFieldChange(field.id, v)}
            readOnly={readOnly}
          />
        )
      case 'formula': {
        const computed = field.formula
          ? evaluateFormula(field.formula, formData)
          : 0
        return <FormulaField key={field.id} field={field} value={computed} />
      }
      case 'file':
        return <FileField key={field.id} field={field} readOnly={readOnly} />
      default:
        return null
    }
    })()

    return (
      <div key={fieldId}>
        {fieldElement}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  if (schema.layout?.sections) {
    return (
      <div className="space-y-6">
        {schema.layout.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.fields.map((fieldId) => renderField(fieldId))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => renderField(field.id))}
    </div>
  )
}
