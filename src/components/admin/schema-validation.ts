import { z } from 'zod'
import type { FormField } from '@/lib/types/database'

// Field type labels in Japanese
export const FIELD_TYPE_LABELS: Record<FormField['type'], string> = {
  text: 'テキスト',
  number: '数値',
  date: '日付',
  select: '選択肢',
  textarea: 'テキストエリア',
  currency: '金額',
  table: 'テーブル',
  formula: '計算式',
  file: 'ファイル',
}

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FormField['type'][]

// Field type badge colors
export const FIELD_TYPE_COLORS: Record<FormField['type'], string> = {
  text: 'bg-gray-100 text-gray-700',
  number: 'bg-blue-100 text-blue-700',
  date: 'bg-green-100 text-green-700',
  select: 'bg-purple-100 text-purple-700',
  textarea: 'bg-gray-200 text-gray-700',
  currency: 'bg-amber-100 text-amber-700',
  table: 'bg-indigo-100 text-indigo-700',
  formula: 'bg-cyan-100 text-cyan-700',
  file: 'bg-rose-100 text-rose-700',
}

// Zod validation schemas
const tableColumnSchema = z.object({
  id: z.string().min(1, '列IDは必須です'),
  type: z.string().min(1),
  label: z.string().min(1, 'ラベルは必須です'),
  width: z.string().optional(),
  formula: z.string().optional(),
}).passthrough()

const formFieldSchema = z.object({
  id: z.string().min(1, 'フィールドIDは必須です'),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea', 'currency', 'table', 'formula', 'file']),
  label: z.string().min(1, 'ラベルは必須です'),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  rows: z.number().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  columns: z.array(tableColumnSchema).optional(),
  minRows: z.number().optional(),
  maxRows: z.number().optional(),
  allowExcelPaste: z.boolean().optional(),
  formula: z.string().optional(),
  width: z.string().optional(),
}).passthrough()

const formSectionSchema = z.object({
  title: z.string().min(1, 'セクション名は必須です'),
  fields: z.array(z.string()),
})

export const formSchemaValidator = z.object({
  version: z.number(),
  fields: z.array(formFieldSchema).min(1, '最低1つのフィールドが必要です'),
  layout: z.object({
    type: z.string(),
    sections: z.array(formSectionSchema),
  }),
}).passthrough()

// Default field templates for creating new fields
export function createDefaultField(type: FormField['type']): FormField {
  const base = {
    id: `field_${Date.now()}`,
    type,
    label: `新規${FIELD_TYPE_LABELS[type]}`,
  }

  switch (type) {
    case 'textarea':
      return { ...base, type, rows: 3 }
    case 'select':
      return { ...base, type, options: [{ value: 'option1', label: '選択肢1' }] }
    case 'table':
      return {
        ...base,
        type,
        minRows: 1,
        maxRows: 20,
        allowExcelPaste: true,
        columns: [
          { id: 'col1', type: 'text', label: '列1', width: '200px' },
        ],
      }
    case 'formula':
      return { ...base, type, formula: '' }
    default:
      return base as FormField
  }
}
