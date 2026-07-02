'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Download } from 'lucide-react'
import { generateFormTemplate, parseFormTemplate } from '@/lib/utils/formTemplate'
import { TextField } from './fields/TextField'
import { NumberField } from './fields/NumberField'
import { DateField } from './fields/DateField'
import { SelectField } from './fields/SelectField'
import { TextareaField } from './fields/TextareaField'
import { CurrencyField } from './fields/CurrencyField'
import { TableField } from './fields/TableField'
import { FormulaField } from './fields/FormulaField'
import { FileField } from './fields/FileField'
import { VendorField } from './fields/VendorField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FormSchema, FormField, Vendor } from '@/lib/types/database'

/** Compute the partial update produced by selecting a vendor in a vendor_select field. */
export function vendorFieldUpdates(field: FormField, vendor: Vendor | null): Record<string, unknown> {
  const updates: Record<string, unknown> = { [field.id]: vendor?.id ?? '' }
  if (field.vendorAutoFill && vendor) {
    for (const af of field.vendorAutoFill) {
      const raw = vendor[af.vendorKey]
      updates[af.fieldId] = raw ?? ''
    }
  } else if (field.vendorAutoFill && !vendor) {
    // Selecting "clear" wipes the auto-filled fields too
    for (const af of field.vendorAutoFill) updates[af.fieldId] = ''
  }
  return updates
}

interface Props {
  schema: FormSchema
  formData: Record<string, unknown>
  onChange?: (data: Record<string, unknown>) => void
  readOnly?: boolean
  errors?: Record<string, string>
  /** 条件書「取込」○ の帳票で、項目一括取込のツールバーを表示する */
  enableTemplateImport?: boolean
  /** テンプレDL/ファイル名に使う表示名 */
  documentName?: string
}

/** 項目一括取込ツールバー（条件書「取込」対応） */
function TemplateImportToolbar({
  schema,
  formData,
  onChange,
  documentName,
}: {
  schema: FormSchema
  formData: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  documentName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const download = async () => {
    const buf = await generateFormTemplate(schema, formData, documentName || '申請テンプレート')
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${documentName || '申請'}_テンプレート.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const updates = await parseFormTemplate(buf, schema)
      const n = Object.keys(updates).length
      onChange({ ...formData, ...updates })
      setMsg(n > 0 ? `${n}項目を取り込みました` : '取り込める項目がありませんでした')
    } catch {
      setMsg('取込に失敗しました（テンプレート形式をご確認ください）')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-blue-50/50 px-3 py-2">
      <span className="text-xs text-gray-600">テンプレートで一括入力:</span>
      <Button type="button" variant="outline" size="sm" onClick={download}>
        <Download className="w-3 h-3 mr-1" />テンプレDL
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="w-3 h-3 mr-1" />テンプレ取込
      </Button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
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

export function FormRenderer({ schema, formData, onChange, readOnly = false, errors = {}, enableTemplateImport = false, documentName }: Props) {
  const showImport = enableTemplateImport && !readOnly && !!onChange
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
      case 'vendor_select':
        return (
          <VendorField
            key={field.id}
            field={field}
            value={value as string}
            onSelect={(vendor) => {
              if (!onChange) return
              onChange({ ...formData, ...vendorFieldUpdates(field, vendor) })
            }}
            readOnly={readOnly}
          />
        )
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
        {showImport && (
          <TemplateImportToolbar schema={schema} formData={formData} onChange={onChange!} documentName={documentName} />
        )}
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
      {showImport && (
        <TemplateImportToolbar schema={schema} formData={formData} onChange={onChange!} documentName={documentName} />
      )}
      {schema.fields.map((field) => renderField(field.id))}
    </div>
  )
}
