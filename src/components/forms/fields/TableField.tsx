'use client'

import { useCallback, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Upload } from 'lucide-react'
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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processExcelData = useCallback(async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown as unknown[][]

      if (!jsonData.length) return

      // First row might be headers - check if they match column labels
      const editableColumns = columns.filter(c => c.type !== 'formula')
      let dataRows = jsonData

      // Check if first row looks like headers
      const firstRow = jsonData[0]
      if (firstRow && editableColumns.some(col =>
        firstRow.some(cell => typeof cell === 'string' && col.label && cell.includes(col.label))
      )) {
        dataRows = jsonData.slice(1)
      }

      const newRows = dataRows
        .filter(row => row.some(cell => cell != null && cell !== ''))
        .map(pastedRow => {
          const row: Record<string, unknown> = {}
          editableColumns.forEach((col, colIdx) => {
            const val = pastedRow[colIdx]
            if (col.type === 'number' || col.type === 'currency') {
              row[col.id] = val != null ? Number(String(val).replace(/[,¥]/g, '')) || 0 : ''
            } else {
              row[col.id] = val != null ? String(val) : ''
            }
          })
          columns.forEach(col => {
            if (col.type === 'formula' && col.formula) {
              row[col.id] = evaluateFormula(col.formula, row)
            }
          })
          return row
        })

      if (newRows.length > 0) {
        onChange(newRows)
      }
    } catch {
      // silently fail
    }
  }, [columns, onChange])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        processExcelData(file)
      }
    }
  }, [processExcelData])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processExcelData(file)
    e.target.value = ''
  }, [processExcelData])

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
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Excelからのコピー＆ペースト（Ctrl+V）またはファイルのドラッグ＆ドロップに対応</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1" />
            ファイル選択
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      <div
        className={`border rounded-md overflow-x-auto transition-colors ${
          isDragging ? 'border-blue-400 bg-blue-50/50 border-dashed border-2' : ''
        }`}
        onDragOver={field.allowExcelPaste && !readOnly ? handleDragOver : undefined}
        onDragLeave={field.allowExcelPaste && !readOnly ? handleDragLeave : undefined}
        onDrop={field.allowExcelPaste && !readOnly ? handleDrop : undefined}
      >
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
