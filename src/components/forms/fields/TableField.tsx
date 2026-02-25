'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { FormField, TableColumn } from '@/lib/types/database'

interface Props {
  field: FormField
  value: Record<string, unknown>[]
  onChange: (value: Record<string, unknown>[]) => void
  readOnly?: boolean
}

function evaluateFormula(formula: string, row: Record<string, unknown>): number {
  try {
    const expr = formula.replace(/[a-z_]+/g, (match) => {
      const val = row[match]
      return typeof val === 'number' ? String(val) : '0'
    })
    return Function(`"use strict"; return (${expr})`)() as number
  } catch {
    return 0
  }
}

export function TableField({ field, value, onChange, readOnly }: Props) {
  const rows = value || [{}]
  const columns = field.columns || []

  const addRow = () => {
    if (field.maxRows && rows.length >= field.maxRows) return
    onChange([...rows, {}])
  }

  const removeRow = (index: number) => {
    if (rows.length <= (field.minRows || 1)) return
    onChange(rows.filter((_, i) => i !== index))
  }

  const updateCell = (rowIndex: number, colId: string, cellValue: unknown) => {
    const newRows = [...rows]
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: cellValue }
    // Recalculate formula columns
    columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        newRows[rowIndex][col.id] = evaluateFormula(col.formula, newRows[rowIndex])
      }
    })
    onChange(newRows)
  }

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTableElement>) => {
    if (readOnly) return
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return

    e.preventDefault()
    const pastedRows = text.trim().split('\n').map(row => row.split('\t'))
    const editableColumns = columns.filter(c => c.type !== 'formula')

    const newRows = pastedRows.map((pastedRow) => {
      const row: Record<string, unknown> = {}
      editableColumns.forEach((col, colIdx) => {
        const val = pastedRow[colIdx]?.trim() || ''
        if (col.type === 'number' || col.type === 'currency') {
          row[col.id] = val ? Number(val.replace(/[,¥]/g, '')) : ''
        } else {
          row[col.id] = val
        }
      })
      // Calculate formulas
      columns.forEach((col) => {
        if (col.type === 'formula' && col.formula) {
          row[col.id] = evaluateFormula(col.formula, row)
        }
      })
      return row
    })

    onChange(newRows.length > 0 ? newRows : [{}])
  }, [columns, onChange, readOnly])

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {field.allowExcelPaste && !readOnly && (
        <p className="text-xs text-gray-500">
          Excelからのコピー＆ペーストに対応しています（Ctrl+V）
        </p>
      )}

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm" onPaste={handlePaste}>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left w-10">#</th>
              {columns.map((col) => (
                <th key={col.id} className="px-2 py-2 text-left" style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
              {!readOnly && <th className="px-2 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t">
                <td className="px-2 py-1 text-gray-400 text-xs">{rowIdx + 1}</td>
                {columns.map((col) => (
                  <td key={col.id} className="px-1 py-1">
                    {renderCell(col, row, rowIdx, readOnly, updateCell)}
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(rowIdx)}
                      disabled={rows.length <= (field.minRows || 1)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={field.maxRows ? rows.length >= field.maxRows : false}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          行を追加
        </Button>
      )}
    </div>
  )
}

function renderCell(
  col: TableColumn,
  row: Record<string, unknown>,
  rowIdx: number,
  readOnly: boolean | undefined,
  updateCell: (rowIdx: number, colId: string, value: unknown) => void
) {
  const val = row[col.id]

  if (col.type === 'formula') {
    return (
      <div className="px-2 py-1 bg-blue-50/50 text-right text-sm">
        {formatCurrency(typeof val === 'number' ? val : 0)}
      </div>
    )
  }

  if (readOnly) {
    if (col.type === 'currency') {
      return (
        <div className="px-2 py-1 text-right">
          {formatCurrency(typeof val === 'number' ? val : Number(val) || 0)}
        </div>
      )
    }
    return <div className="px-2 py-1">{String(val || '')}</div>
  }

  if (col.type === 'number' || col.type === 'currency') {
    return (
      <Input
        type="number"
        value={val != null ? String(val) : ''}
        onChange={(e) => updateCell(rowIdx, col.id, e.target.value === '' ? '' : Number(e.target.value))}
        className="h-8 text-right text-sm"
      />
    )
  }

  return (
    <Input
      value={val != null ? String(val) : ''}
      onChange={(e) => updateCell(rowIdx, col.id, e.target.value)}
      className="h-8 text-sm"
    />
  )
}
