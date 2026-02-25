import type { FormSchema, FormField, TableColumn, FormSection } from '@/lib/types/database'

export interface ParseResult {
  schema: FormSchema
  warnings: string[]
  stats: {
    fieldCount: number
    sectionCount: number
    tableFieldCount: number
  }
}

const TYPE_MAP: Record<string, FormField['type']> = {
  text: 'text',
  テキスト: 'text',
  number: 'number',
  数値: 'number',
  date: 'date',
  日付: 'date',
  select: 'select',
  選択肢: 'select',
  textarea: 'textarea',
  テキストエリア: 'textarea',
  currency: 'currency',
  金額: 'currency',
  table: 'table',
  テーブル: 'table',
  formula: 'formula',
  計算式: 'formula',
  file: 'file',
  ファイル: 'file',
}

function normalizeType(raw: string): FormField['type'] {
  const key = String(raw).trim().toLowerCase()
  return TYPE_MAP[key] || TYPE_MAP[String(raw).trim()] || 'text'
}

function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toUpperCase()
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'はい' || s === '○'
}

// ---- Structured format (multi-sheet) ----

export function parseStructuredExcel(workbook: { SheetNames: string[]; Sheets: Record<string, unknown> }): ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const warnings: string[] = []

  // Sheet 1: フィールド定義
  const fieldSheetName = workbook.SheetNames.find(n => n.includes('フィールド定義')) || workbook.SheetNames[0]
  const fieldSheet = workbook.Sheets[fieldSheetName]
  const fieldRows: unknown[][] = XLSX.utils.sheet_to_json(fieldSheet, { header: 1 })

  if (fieldRows.length < 2) {
    return {
      schema: { version: 1, fields: [], layout: { type: 'sections', sections: [] } },
      warnings: ['フィールド定義シートにデータがありません'],
      stats: { fieldCount: 0, sectionCount: 0, tableFieldCount: 0 },
    }
  }

  // Parse headers
  const headers = (fieldRows[0] as string[]).map(h => String(h).trim())
  const col = (name: string) => headers.indexOf(name)
  const idCol = Math.max(col('フィールドID'), col('id'), 0)
  const typeCol = Math.max(col('タイプ'), col('type'), 1)
  const labelCol = Math.max(col('ラベル'), col('label'), 2)
  const requiredCol = Math.max(col('必須'), col('required'), -1)
  const placeholderCol = Math.max(col('プレースホルダー'), col('placeholder'), -1)
  const sectionCol = Math.max(col('セクション'), col('section'), -1)
  const defaultCol = Math.max(col('デフォルト値'), col('default'), -1)
  const formulaCol = Math.max(col('計算式'), col('formula'), -1)

  const fields: FormField[] = []
  const sectionMap = new Map<string, string[]>()

  for (let i = 1; i < fieldRows.length; i++) {
    const row = fieldRows[i] as unknown[]
    if (!row || !row[idCol]) continue

    const fieldId = String(row[idCol]).trim()
    const fieldType = normalizeType(String(row[typeCol] || 'text'))

    const field: FormField = {
      id: fieldId,
      type: fieldType,
      label: String(row[labelCol] || fieldId),
    }

    if (requiredCol >= 0 && row[requiredCol]) field.required = toBool(row[requiredCol])
    if (placeholderCol >= 0 && row[placeholderCol]) field.placeholder = String(row[placeholderCol])
    if (defaultCol >= 0 && row[defaultCol]) field.defaultValue = String(row[defaultCol])
    if (formulaCol >= 0 && row[formulaCol]) field.formula = String(row[formulaCol])

    if (fieldType === 'table') {
      field.minRows = 1
      field.maxRows = 20
      field.allowExcelPaste = true
      field.columns = []
    }

    if (fieldType === 'textarea') {
      field.rows = 3
    }

    fields.push(field)

    // Section assignment
    const sectionName = sectionCol >= 0 && row[sectionCol] ? String(row[sectionCol]).trim() : '基本情報'
    if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, [])
    sectionMap.get(sectionName)!.push(fieldId)
  }

  // Sheet 2: テーブル列定義
  const colSheetName = workbook.SheetNames.find(n => n.includes('テーブル列定義') || n.includes('列定義'))
  if (colSheetName) {
    const colSheet = workbook.Sheets[colSheetName]
    const colRows: unknown[][] = XLSX.utils.sheet_to_json(colSheet, { header: 1 })

    if (colRows.length >= 2) {
      const cHeaders = (colRows[0] as string[]).map(h => String(h).trim())
      const cTableIdCol = Math.max(cHeaders.indexOf('テーブルフィールドID'), cHeaders.indexOf('table_id'), 0)
      const cColIdCol = Math.max(cHeaders.indexOf('列ID'), cHeaders.indexOf('column_id'), 1)
      const cTypeCol = Math.max(cHeaders.indexOf('タイプ'), cHeaders.indexOf('type'), 2)
      const cLabelCol = Math.max(cHeaders.indexOf('ラベル'), cHeaders.indexOf('label'), 3)
      const cWidthCol = Math.max(cHeaders.indexOf('幅'), cHeaders.indexOf('width'), -1)
      const cFormulaCol = Math.max(cHeaders.indexOf('計算式'), cHeaders.indexOf('formula'), -1)

      for (let i = 1; i < colRows.length; i++) {
        const row = colRows[i] as unknown[]
        if (!row || !row[cTableIdCol]) continue

        const tableFieldId = String(row[cTableIdCol]).trim()
        const tableField = fields.find(f => f.id === tableFieldId && f.type === 'table')

        if (!tableField) {
          warnings.push(`テーブル「${tableFieldId}」が見つかりません（行${i + 1}）`)
          continue
        }

        const column: TableColumn = {
          id: String(row[cColIdCol] || `col_${i}`).trim(),
          type: normalizeType(String(row[cTypeCol] || 'text')),
          label: String(row[cLabelCol] || ''),
        }

        if (cWidthCol >= 0 && row[cWidthCol]) column.width = String(row[cWidthCol]).trim()
        if (cFormulaCol >= 0 && row[cFormulaCol]) column.formula = String(row[cFormulaCol]).trim()

        if (!tableField.columns) tableField.columns = []
        tableField.columns.push(column)
      }
    }
  }

  // Sheet 3: 選択肢定義
  const optSheetName = workbook.SheetNames.find(n => n.includes('選択肢定義') || n.includes('選択肢'))
  if (optSheetName) {
    const optSheet = workbook.Sheets[optSheetName]
    const optRows: unknown[][] = XLSX.utils.sheet_to_json(optSheet, { header: 1 })

    if (optRows.length >= 2) {
      const oHeaders = (optRows[0] as string[]).map(h => String(h).trim())
      const oFieldIdCol = Math.max(oHeaders.indexOf('フィールドID'), oHeaders.indexOf('field_id'), 0)
      const oValueCol = Math.max(oHeaders.indexOf('値'), oHeaders.indexOf('value'), 1)
      const oLabelCol = Math.max(oHeaders.indexOf('ラベル'), oHeaders.indexOf('label'), 2)

      for (let i = 1; i < optRows.length; i++) {
        const row = optRows[i] as unknown[]
        if (!row || !row[oFieldIdCol]) continue

        const fieldId = String(row[oFieldIdCol]).trim()
        const selectField = fields.find(f => f.id === fieldId && f.type === 'select')

        if (!selectField) {
          warnings.push(`選択肢フィールド「${fieldId}」が見つかりません（行${i + 1}）`)
          continue
        }

        if (!selectField.options) selectField.options = []
        selectField.options.push({
          value: String(row[oValueCol] || ''),
          label: String(row[oLabelCol] || row[oValueCol] || ''),
        })
      }
    }
  }

  // Build sections
  const sections: FormSection[] = []
  for (const [title, fieldIds] of sectionMap) {
    sections.push({ title, fields: fieldIds })
  }

  const schema: FormSchema = {
    version: 1,
    fields,
    layout: { type: 'sections', sections },
  }

  const tableFieldCount = fields.filter(f => f.type === 'table').length

  return {
    schema,
    warnings,
    stats: {
      fieldCount: fields.length,
      sectionCount: sections.length,
      tableFieldCount,
    },
  }
}

// ---- Auto-detect format (single sheet) ----

function inferFieldType(values: unknown[]): FormField['type'] {
  const nonEmpty = values.filter(v => v != null && v !== '')
  if (nonEmpty.length === 0) return 'text'

  const allNumbers = nonEmpty.every(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''))
  if (allNumbers) {
    const nums = nonEmpty.map(Number)
    const avg = nums.reduce((s, v) => s + v, 0) / nums.length
    if (avg > 100) return 'currency'
    return 'number'
  }

  const allDates = nonEmpty.every(v => {
    if (v instanceof Date) return true
    const s = String(v)
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)
  })
  if (allDates) return 'date'

  const unique = new Set(nonEmpty.map(String))
  if (unique.size <= 10 && unique.size < nonEmpty.length * 0.5) return 'select'

  if (nonEmpty.some(v => String(v).length > 100)) return 'textarea'

  return 'text'
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\w\u3000-\u9fff]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || `field_${Date.now()}`
}

export function parseAutoDetectExcel(workbook: { SheetNames: string[]; Sheets: Record<string, unknown> }): ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const warnings: string[] = []

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  if (rows.length < 1) {
    return {
      schema: { version: 1, fields: [], layout: { type: 'sections', sections: [] } },
      warnings: ['シートにデータがありません'],
      stats: { fieldCount: 0, sectionCount: 0, tableFieldCount: 0 },
    }
  }

  const headers = (rows[0] as unknown[]).map(h => String(h || '').trim()).filter(Boolean)
  const dataRows = rows.slice(1).filter(r => r && r.length > 0)

  const fields: FormField[] = []
  const usedIds = new Set<string>()

  for (let c = 0; c < headers.length; c++) {
    const label = headers[c]
    let fieldId = slugify(label)
    if (usedIds.has(fieldId)) fieldId = `${fieldId}_${c}`
    usedIds.add(fieldId)

    const columnValues = dataRows.map(r => (r as unknown[])[c])
    const fieldType = inferFieldType(columnValues)

    const field: FormField = { id: fieldId, type: fieldType, label }

    if (fieldType === 'select') {
      const unique = [...new Set(columnValues.filter(v => v != null && v !== '').map(String))]
      field.options = unique.map(v => ({ value: v, label: v }))
    }

    if (fieldType === 'textarea') field.rows = 3

    fields.push(field)
    warnings.push(`「${label}」→ ${fieldType}（自動推定）`)
  }

  const schema: FormSchema = {
    version: 1,
    fields,
    layout: {
      type: 'sections',
      sections: [{ title: '基本情報', fields: fields.map(f => f.id) }],
    },
  }

  return {
    schema,
    warnings,
    stats: { fieldCount: fields.length, sectionCount: 1, tableFieldCount: 0 },
  }
}

export function detectExcelFormat(workbook: { SheetNames: string[] }): 'structured' | 'auto' {
  return workbook.SheetNames.some(n => n.includes('フィールド定義')) ? 'structured' : 'auto'
}

// ---- Sample Excel generator ----

export async function generateSampleExcel(): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const fieldData = [
    ['フィールドID', 'タイプ', 'ラベル', '必須', 'プレースホルダー', 'セクション', 'デフォルト値', '計算式'],
    ['title', 'text', '件名', 'TRUE', '申請の件名を入力', '基本情報', '', ''],
    ['apply_date', 'date', '申請日', 'TRUE', '', '基本情報', 'today', ''],
    ['applicant_dept', 'text', '申請部署', 'FALSE', '', '基本情報', '', ''],
    ['purpose', 'textarea', '目的・理由', 'TRUE', '申請の目的を入力してください', '基本情報', '', ''],
    ['category', 'select', '分類', 'TRUE', '', '基本情報', '', ''],
    ['items', 'table', '明細', 'FALSE', '', '明細情報', '', ''],
    ['total_amount', 'formula', '合計金額', 'FALSE', '', '金額情報', '', 'SUM(items.subtotal)'],
    ['remarks', 'textarea', '備考', 'FALSE', '特記事項があれば入力', '備考', '', ''],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(fieldData)
  ws1['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'フィールド定義')

  const columnData = [
    ['テーブルフィールドID', '列ID', 'タイプ', 'ラベル', '幅', '計算式'],
    ['items', 'item_name', 'text', '品名', '200px', ''],
    ['items', 'quantity', 'number', '数量', '80px', ''],
    ['items', 'unit_price', 'currency', '単価', '120px', ''],
    ['items', 'subtotal', 'formula', '小計', '120px', 'quantity * unit_price'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(columnData)
  ws2['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'テーブル列定義')

  const optionData = [
    ['フィールドID', '値', 'ラベル'],
    ['category', 'office', '事務用品'],
    ['category', 'equipment', '設備・備品'],
    ['category', 'travel', '出張・交通'],
    ['category', 'other', 'その他'],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(optionData)
  ws3['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws3, '選択肢定義')

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
