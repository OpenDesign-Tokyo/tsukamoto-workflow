'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { FIELD_TYPE_LABELS, FIELD_TYPES } from './schema-validation'
import { TableColumnEditor } from './TableColumnEditor'
import type { FormField } from '@/lib/types/database'

interface Props {
  field: FormField
  onChange: (updated: FormField) => void
}

export function FieldEditor({ field, onChange }: Props) {
  const update = (updates: Partial<FormField>) => {
    onChange({ ...field, ...updates } as FormField)
  }

  const handleTypeChange = (newType: FormField['type']) => {
    const base: FormField = { id: field.id, type: newType, label: field.label }
    if (field.required) base.required = field.required

    switch (newType) {
      case 'textarea':
        base.rows = 3
        break
      case 'select':
        base.options = field.options || [{ value: 'option1', label: '選択肢1' }]
        break
      case 'table':
        base.columns = field.columns || [{ id: 'col1', type: 'text', label: '列1', width: '200px' }]
        base.minRows = field.minRows || 1
        base.maxRows = field.maxRows || 20
        base.allowExcelPaste = true
        break
      case 'formula':
        base.formula = field.formula || ''
        break
    }

    onChange(base)
  }

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-md border">
      {/* Row 1: ID, Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">フィールドID</Label>
          <Input
            value={field.id}
            onChange={e => update({ id: e.target.value })}
            className="h-8 text-xs font-mono mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">タイプ</Label>
          <Select value={field.type} onValueChange={v => handleTypeChange(v as FormField['type'])}>
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map(t => (
                <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Label, Required */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-gray-500">ラベル</Label>
          <Input
            value={field.label}
            onChange={e => update({ label: e.target.value })}
            className="h-8 text-xs mt-1"
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            checked={field.required || false}
            onCheckedChange={v => update({ required: v })}
          />
          <Label className="text-xs">必須</Label>
        </div>
      </div>

      {/* Placeholder (text, number, textarea, currency) */}
      {['text', 'number', 'textarea', 'currency'].includes(field.type) && (
        <div>
          <Label className="text-xs text-gray-500">プレースホルダー</Label>
          <Input
            value={field.placeholder || ''}
            onChange={e => update({ placeholder: e.target.value || undefined })}
            className="h-8 text-xs mt-1"
            placeholder="入力のヒントテキスト"
          />
        </div>
      )}

      {/* Default value */}
      {['text', 'number', 'date', 'select', 'textarea'].includes(field.type) && (
        <div>
          <Label className="text-xs text-gray-500">デフォルト値</Label>
          <Input
            value={field.defaultValue || ''}
            onChange={e => update({ defaultValue: e.target.value || undefined })}
            className="h-8 text-xs mt-1"
            placeholder={field.type === 'date' ? 'today = 今日の日付' : ''}
          />
        </div>
      )}

      {/* Rows (textarea) */}
      {field.type === 'textarea' && (
        <div>
          <Label className="text-xs text-gray-500">行数</Label>
          <Input
            type="number"
            value={field.rows || 3}
            onChange={e => update({ rows: parseInt(e.target.value) || 3 })}
            className="h-8 text-xs mt-1 w-20"
            min={1}
            max={20}
          />
        </div>
      )}

      {/* Formula */}
      {field.type === 'formula' && (
        <div>
          <Label className="text-xs text-gray-500">計算式</Label>
          <Input
            value={field.formula || ''}
            onChange={e => update({ formula: e.target.value })}
            className="h-8 text-xs font-mono mt-1"
            placeholder="例: SUM(items.subtotal)"
          />
          <p className="text-[10px] text-gray-400 mt-1">SUM(テーブルID.列ID) 形式で集計可能</p>
        </div>
      )}

      {/* Options (select) */}
      {field.type === 'select' && (
        <div>
          <Label className="text-xs text-gray-500">選択肢</Label>
          <div className="space-y-1.5 mt-1">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt.value}
                  onChange={e => {
                    const next = [...(field.options || [])]
                    next[i] = { ...next[i], value: e.target.value }
                    update({ options: next })
                  }}
                  placeholder="値"
                  className="h-7 text-xs font-mono w-28"
                />
                <Input
                  value={opt.label}
                  onChange={e => {
                    const next = [...(field.options || [])]
                    next[i] = { ...next[i], label: e.target.value }
                    update({ options: next })
                  }}
                  placeholder="ラベル"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                  onClick={() => {
                    const next = (field.options || []).filter((_, idx) => idx !== i)
                    update({ options: next })
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const next = [...(field.options || []), { value: `option${(field.options?.length || 0) + 1}`, label: '新規選択肢' }]
                update({ options: next })
              }}
            >
              <Plus className="w-3 h-3 mr-1" />選択肢を追加
            </Button>
          </div>
        </div>
      )}

      {/* Table columns */}
      {field.type === 'table' && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div>
              <Label className="text-xs text-gray-500">最小行数</Label>
              <Input
                type="number"
                value={field.minRows || 1}
                onChange={e => update({ minRows: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs mt-1 w-20"
                min={0}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">最大行数</Label>
              <Input
                type="number"
                value={field.maxRows || 20}
                onChange={e => update({ maxRows: parseInt(e.target.value) || 20 })}
                className="h-8 text-xs mt-1 w-20"
                min={1}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch
                checked={field.allowExcelPaste ?? true}
                onCheckedChange={v => update({ allowExcelPaste: v })}
              />
              <Label className="text-xs">Excel貼り付け</Label>
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">テーブル列定義</Label>
            <div className="mt-1">
              <TableColumnEditor
                columns={field.columns || []}
                onChange={columns => update({ columns })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
