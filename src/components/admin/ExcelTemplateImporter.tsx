'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { FIELD_TYPE_LABELS } from './schema-validation'
import {
  parseStructuredExcel,
  parseAutoDetectExcel,
  detectExcelFormat,
  generateSampleExcel,
  type ParseResult,
} from '@/lib/utils/parseExcelToSchema'
import type { FormSchema, FormField } from '@/lib/types/database'

interface Props {
  onImport: (schema: FormSchema) => void
}

export function ExcelTemplateImporter({ onImport }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })

      const format = detectExcelFormat(wb)
      const parsed = format === 'structured'
        ? parseStructuredExcel(wb)
        : parseAutoDetectExcel(wb)

      setResult(parsed)
    } catch (e) {
      setError(`Excelの解析に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const downloadSample = useCallback(async () => {
    const buffer = await generateSampleExcel()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'テンプレート定義サンプル.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-sm text-gray-600 space-y-1">
        <p>Excelファイルをアップロードすると、フォームテンプレートに自動変換します。</p>
        <p className="text-xs text-gray-400">
          推奨: 3シート構成（フィールド定義/テーブル列定義/選択肢定義）。単一シートの場合は自動推定します。
        </p>
      </div>

      {/* Sample download */}
      <Button variant="outline" size="sm" onClick={downloadSample} className="text-xs">
        <Download className="w-3.5 h-3.5 mr-1.5" />
        サンプルExcelをダウンロード
      </Button>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">解析中...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Upload className="w-8 h-8" />
            <span className="text-sm">Excelファイルをドラッグ＆ドロップ</span>
            <span className="text-xs text-gray-400">または クリックしてファイルを選択</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Parse result */}
      {result && (
        <div className="space-y-3">
          {/* Stats */}
          <div className="rounded-md border bg-green-50 border-green-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">変換完了</span>
            </div>
            <div className="flex gap-4 text-xs text-green-700">
              <span>フィールド: {result.stats.fieldCount}件</span>
              <span>セクション: {result.stats.sectionCount}件</span>
              {result.stats.tableFieldCount > 0 && (
                <span>テーブル: {result.stats.tableFieldCount}件</span>
              )}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">注意事項:</p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {result.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
                {result.warnings.length > 10 && (
                  <li>...他 {result.warnings.length - 10}件</li>
                )}
              </ul>
            </div>
          )}

          {/* Field preview */}
          <div className="border rounded-md">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b">
              検出されたフィールド
            </div>
            <div className="divide-y max-h-60 overflow-y-auto">
              {result.schema.fields.map((field: FormField) => (
                <div key={field.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-mono text-gray-500 w-28 truncate">{field.id}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {FIELD_TYPE_LABELS[field.type] || field.type}
                  </Badge>
                  <span className="text-gray-700 truncate">{field.label}</span>
                  {field.required && <span className="text-red-500">*</span>}
                  {field.type === 'table' && field.columns && (
                    <span className="text-gray-400">({field.columns.length}列)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>
              やり直す
            </Button>
            <Button size="sm" onClick={() => onImport(result.schema)}>
              ビジュアルエディタで確認
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
